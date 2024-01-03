/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {simpleStringHash} from '../../../common/ws-data-format.js';
import {Vector3, Quaternion} from 'three';
import parseSequence, {getJointTag} from 'aw-sequence-parser';
import * as fflate from 'fflate';

const seqsSubpath = 'seqs';
const transitionDuration = 150; // in milliseconds
const rollbackTolerance = 0.25; // in seconds

const seqOpts = {fflate, cors: true};

/**
 * Format parsed sequence data into three.js-friendly array of frames
 * @param {Object} parsedSeq - Parsed sequence, as returned by the
 *                             parseSequence function from
 *                             aw-sequence-parser.
 * @return {Array<Object>} Array of frames from the provided sequence
 *                         data.
 */
function formatParsedSeq(parsedSeq) {
  const entries = Object.entries(parsedSeq.frames).map(
      ([i, frame]) => {
        const formatted = {
          location: new Vector3(...frame.location).multiplyScalar(0.1),
          joints: {},
        };

        for (const [key, q] of Object.entries(frame.joints)) {
          const tag = getJointTag(key);

          formatted.joints[tag] =
          new Quaternion(-q[1], -q[2], q[3], q[0]);
        }

        return [parseInt(i), {frame, formatted}];
      }).sort((a, b) => a[0] - b[0]);

  return entries;
}

/**
 * Populate the avatarView map based on the provided three.js Group
 * for a single avatar model;
 * This map will be a lookup table for specific joints within
 * the avatar, indexed by the numeric value of the joint type
 * @param {Group} group - three.js object holding all the
 *                        avatar geometry with tagged joints.
 * @param {Object} avatarView - Empty dictionary to fill.
 */
function populateAvatarViewRecursive(group, avatarView) {
  if (group.userData?.rwx?.tag) {
    avatarView[group.userData.rwx.tag] = group;
    group.userData.originalPosition = group.position.clone();
    group.userData.originalRotation = group.rotation.clone();
  }

  group.children.forEach((child) => {
    if (child.isGroup) {
      populateAvatarViewRecursive(child, avatarView);
    }
  });
}

/**
 * Reset each joint in the avatarView map to its original position
 * and rotation
 * @param {Object} avatarView - Filled lookup map for the joints.
 */
function resetAvatarView(avatarView) {
  for (const node of Object.values(avatarView)) {
    let update = false;

    if (node.userData.originalPosition) {
      node.position.copy(node.userData.originalPosition);
      update = true;
    }

    if (node.userData.originalRotation) {
      node.rotation.copy(node.userData.originalRotation);
      update = true;
    }

    if (update) node.updateMatrix();
  }
}

/**
 * Update the joints of an avatar to match a specific animation step,
 * uses interpolation between two reference frames
 * @param {Object} avatarView - Filled lookup map for the joints.
 * @param {Object} startFrame - Starting frame for the interpolation.
 * @param {Object} endFrame - Ending frame for interpolation.
 * @param {string} rootJointName - Name of the root joint, containing all
 *                                 the others has its children.
 * @param {number} progress - Completion rate of the target step, related to
 *                            the first and last frames, 0 means first frame
 *                            and 1 means last frame, anything in-between will
 *                            be interpolated.
 * @param {boolean} translate - Whether or not to apply translation to the root
 *                              joint (as dictated by the provided frames).
 * @return {Object} The interpolated frame.
 */
function animateAvatar(avatarView, startFrame, endFrame, rootJointName,
    progress, translate = true) {
  const startQuaternion = new Quaternion();
  const startPosition = new Vector3();

  const rootJointTag = getJointTag(rootJointName);
  const interpolatedFrame = {location: new Vector3(), joints: {}};

  for (const [tag, q] of Object.entries(startFrame.joints)) {
    if (avatarView[tag] === undefined) {
      continue;
    }

    startQuaternion.copy(q);

    const end = endFrame.joints[tag];
    if (!end) continue;

    startQuaternion.slerp(end, progress);

    avatarView[tag].setRotationFromQuaternion(startQuaternion);
    avatarView[tag].needsUpdate = true;

    interpolatedFrame.joints[tag] = (new Quaternion()).copy(startQuaternion);
  }

  if (avatarView[rootJointTag] === undefined || !translate) {
    return interpolatedFrame;
  }

  startPosition.copy(startFrame.location);
  avatarView[rootJointTag].position
      .copy(startPosition.lerp(endFrame.location, progress));

  avatarView[rootJointTag].needsUpdate = true;
  interpolatedFrame.location.copy(startPosition);

  return interpolatedFrame;
}

/**
 * Get the implicit animation name matching the provided user state
 * @param {Object} userState - User state object holding those entries:
 *                             {flying, running, idle}
 * @return {string} Implicit animation name.
 */
function userStateToImplicit(userState) {
  const {flying, running, idle} = userState;

  if (flying) return 'fly';
  if (idle) return 'idle';

  if (running) return 'run';
  else return 'walk';

  return '';
}

/**
 * Update implicit animation for entities
 * @param {Group} node - three.js 3D group for the target avatar model.
 * @param {integer} hash - 16-bit hash of the target sequence name.
 * @param {number} speed - Playing speed for the animation, use negative
 *                         value to go backwards.
 * @param {AnimationManager} animationManager - Instance of AnimationManager.
 */
function animateEntityImp(node, hash, speed, animationManager) {
  const now = Date.now();
  const startTime = node.userData.startTime ?
      node.userData.startTime : now;
  animationManager.animate(node, hash,
      (now - startTime) * 0.001, speed, false);
}

/**
 * Update explicit animation for entities
 * @param {Group} node - three.js 3D group for the target avatar model.
 * @param {integer} hash - 16-bit hash of the target sequence name.
 * @param {number} progress - Progress ratio for this animation, 0 means
 *                            first frame and 1 means last frame.
 * @param {AnimationManager} animationManager - Instance of AnimationManager.
 */
function animateEntityExp(node, hash, progress, animationManager) {
  const duration = animationManager.probeSequenceDuration(hash);
  let explicitElapsed = duration * progress; // in seconds
  const now = Date.now(); // in milliseconds

  // Note: the rollback tolerance sets a timestamp limit below which
  //       we consider the current explicit animation to have actually
  //       changed, as opposed to a rollback scenario where the local
  //       playback of the animation is just a bit ahead of what we've
  //       last received from the server
  if (!node.userData.explicit ||
      node.userData.explicit.elapsed - rollbackTolerance > explicitElapsed) {
    node.userData.explicit = {
      elapsed: explicitElapsed,
      time: now,
    };
  }

  if (node.userData.explicit.elapsed >= explicitElapsed) {
    // This explicit animation is still running, but we've
    // not received any progress update since last time or
    // we're experiencing some rollback, so we go ahead and
    // keep playing it for ourselves for the sake of keeping
    // things smooth
    explicitElapsed += (now - node.userData.explicit.time) * 0.001;
  } else {
    node.userData.explicit.elapsed = explicitElapsed;
  }

  // Stop right away if we've outlived the animation already
  if (explicitElapsed >= duration) {
    node.userData.explicit.elapsed = duration;
    return;
  }

  node.userData.explicit.time = now;
  animationManager.animate(node, hash,
      explicitElapsed, 1.0, true);
}

/**
 * Manage animation of avatars
 */
class AnimationManager {
  /**
   * @constructor
   */
  constructor() {
    this.paths = new Map();
    this.setPath('/');
  }

  /**
   * Set the current AW world path containing the avatars (.dat file)
   * and all the corresponding sequences (.zip files)
   * @param {string} path - AW world path to set.
   */
  setPath(path) {
    this.path = path;
    if (!this.paths.has(path)) {
      this.paths.set(path,
          {avatars: new Map(), sequences: new Map()});
    }
  }

  /**
   * Load the animation sequences data for a single avatar
   * @param {string} name - Name of the avatar to load the sequences for.
   * @param {Object} imp - Dictionary of implicit sequence file names,
   *                       indexed by the animation names.
   * @param {Object} exp - Dictionary of implicit sequence file names,
   *                       indexed by the animation names.
   */
  async loadAvatarSequences(name, imp, exp) {
    const path = this.paths.get(this.path);
    const seqsToLoad = new Map();

    if (!path.avatars.has(name)) {
      path.avatars.set(name,
          {imp: new Map(), exp: new Map()});
    }

    const avatarSequences = path.avatars.get(name);
    const sequences = path.sequences;

    for (const [name, seq] of Object.entries(imp)) {
      const hash = simpleStringHash(seq);

      // This sequence is already loaded, skip
      if (avatarSequences.imp.has(name)) continue;
      avatarSequences.imp.set(name, hash);

      seqsToLoad.set(seq, hash);
    }

    for (const [name, seq] of Object.entries(exp)) {
      const hash = simpleStringHash(seq);

      // This sequence is already loaded, skip
      if (avatarSequences.exp.has(name)) continue;
      avatarSequences.exp.set(name, hash);

      seqsToLoad.set(seq, hash);
    }

    seqsToLoad.forEach((hash, seq) => {
      const path = [this.path, seqsSubpath, seq].join('/');

      if (!sequences.has(hash)) {
        sequences.set(hash, null);
        parseSequence(`${path}.zip`, seqOpts)
            .then((parsedSeq) => {
              parsedSeq.formatted = formatParsedSeq(parsedSeq);
              sequences.set(hash, {seq, parsedSeq});
            }).catch((e) => {
              console.warn(e);
            } );
      }
    });
  }

  /**
   * Update the joints of an avatar to match a specific implicit animation
   * time
   * @param {Group} group - three.js 3D group for the target avatar model.
   * @param {string} avatarName - Name of the avatar to animate.
   * @param {string} animationName - Name of the implicit animation.
   * @param {number} elapsed - Elapsed time for this animation (in seconds).
   * @param {number} speed - Playing speed for the animation, use negative
   *                         value to go backwards.
   */
  animateImplicit(group, avatarName, animationName, elapsed, speed = 1.0) {
    let hash = this.paths.get(this.path)?.avatars
        .get(avatarName)?.imp.get(animationName);

    if (!hash) {
      // No sequence for this animation name, try to fallback on
      // another one...
      const walkHash = this.paths.get(this.path)?.avatars
          .get(avatarName)?.imp.get('walk');
      const runHash = this.paths.get(this.path)?.avatars
          .get(avatarName)?.imp.get('run');
      const flyHash = this.paths.get(this.path)?.avatars
          .get(avatarName)?.imp.get('fly');

      switch (animationName) {
        case 'walk':
          hash = runHash ? runHash : flyHash;
          break;
        case 'run':
          hash = walkHash ? walkHash : flyHash;
          break;
      }
    }

    group.userData.lastImplicitHash = hash;
    this.animate(group, hash, elapsed, speed, false);
  }

  /**
   * Update the joints of an avatar to match a specific explicit animation
   * time
   * @param {Group} group - three.js 3D group for the target avatar model.
   * @param {string} avatarName - Name of the avatar to animate.
   * @param {string} animationName - Name of the explicit animation.
   * @param {number} elapsed - Elapsed time for this animation (in seconds).
   * @param {number} speed - Playing speed for the animation, use negative
   *                         value to go backwards.
   */
  animateExplicit(group, avatarName, animationName, elapsed, speed = 1.0) {
    const hash = this.paths.get(this.path)?.avatars
        .get(avatarName)?.exp.get(animationName);
    group.userData.lastExplicitHash = hash;
    this.animate(group, hash, elapsed, speed, true);
  }

  /**
   * Get the duration of an implicit animation sequence.
   * @param {string} avatarName - Name of the avatar to animate.
   * @param {string} animationName - Name of the implicit animation.
   * @return {number} Duration of the animation in seconds, 0 if not found.
   */
  probeImplicitAnimationDuration(avatarName, animationName) {
    const hash = this.paths.get(this.path)?.avatars
        .get(avatarName)?.imp.get(animationName);

    return this.probeSequenceDuration(hash);
  }

  /**
   * Get the duration of an explicit animation sequence.
   * @param {string} avatarName - Name of the avatar to animate.
   * @param {string} animationName - Name of the explicit animation.
   * @return {number} Duration of the animation in seconds, 0 if not found.
   */
  probeExplicitAnimationDuration(avatarName, animationName) {
    const hash = this.paths.get(this.path)?.avatars
        .get(avatarName)?.exp.get(animationName);

    return this.probeSequenceDuration(hash);
  }

  /**
   * Get the duration of a specific animation sequence.
   * @param {integer} hash - 16-bit hash of the target sequence name.
   * @return {number} Duration of the animation in seconds, 0 if not found.
   */
  probeSequenceDuration(hash) {
    const parsedSeq =
          this.paths.get(this.path)?.sequences.get(hash)?.parsedSeq;

    if (!parsedSeq) return 0;

    const fps = parsedSeq.fileType === 'binary' ? 30. : 1000.;
    const nbFrames = parsedSeq.totalNFrames;
    const duration = nbFrames / fps;

    return duration;
  }

  /**
   * Update the joints of an avatar to match a specific sequence time
   * @param {Group} group - three.js 3D group for the target avatar model.
   * @param {integer} hash - 16-bit hash of the target sequence name.
   * @param {number} elapsed - Elapsed time for this animation (in seconds).
   * @param {number} speed - Playing speed for the animation, use negative
   *                         value to go backwards.
   * @param {boolean} translate - Whether or not to apply translation to the
   *                              root joint.
   */
  animate(group, hash, elapsed, speed = 1.0, translate = true) {
    if (!group.userData.avatarView) {
      group.userData.avatarView = {};
      populateAvatarViewRecursive(group, group.userData.avatarView);
    }

    const now = Date.now();
    const parsedSeq =
        this.paths.get(this.path)?.sequences.get(hash)?.parsedSeq;
    if (!parsedSeq) {
      resetAvatarView(group.userData.avatarView);
      if (group.userData.lastFrame) {
        Object.assign(group.userData.lastFrame,
            {
              time: now,
              hash,
              speed,
            });
      }
      return;
    }

    const avatarView = group.userData.avatarView;

    const fps = parsedSeq.fileType === 'binary' ? 30. : 1000.;
    const nbFrames = parsedSeq.totalNFrames;
    const frames = parsedSeq.formatted;

    const duration = nbFrames / fps;
    let targetTime = (elapsed * speed) % duration;
    while (targetTime < 0) targetTime += duration;

    const targetFrameId = fps * targetTime;

    let startFramePos = 0;
    let endFramePos = frames.length - 1;

    const firstEntry = frames[0][0];
    const lastEntry = frames.slice(-1)[0][0];
    let startFrameId = firstEntry;
    let endFrameId = lastEntry;

    // If the target frame is behind the first available entry,
    // or beyond the last available entry, then the start
    // frame will be the last available entry and the end frame
    // will be the first available one (looping around)
    if (targetFrameId < firstEntry || targetFrameId > lastEntry) {
      startFrameId = lastEntry;
      endFrameId = firstEntry;
      startFramePos = frames.length - 1;
      endFramePos = 0;
    } else {
      for (let i = 0; i < frames.length; i++) {
        const [id] = frames[i];
        if (id < targetFrameId) {
          // Looking for the starting frame
          startFrameId = id;
          startFramePos = i;
        } else {
          // Looking for the ending frame
          endFrameId = id;
          endFramePos = i;
          break;
        }
      }
    }

    if (group.userData.lastFrame &&
        group.userData.lastFrame.hash !== hash &&
        group.userData.lastFrame.time > now - transitionDuration) {
      // Transitionning from last animation to a new one
      const progress =
          (now - group.userData.lastFrame.time) / transitionDuration;

      animateAvatar(avatarView, group.userData.lastFrame,
          frames[endFramePos][1].formatted, parsedSeq.rootJointName,
          progress, translate);
    } else {
      // Normalize the progress value to match
      // the bounding frames as a reference
      let sProgress = startFrameId / (nbFrames - 1.0);
      let eProgress = endFrameId / (nbFrames - 1.0);
      let progress = targetTime / duration;

      if (sProgress > eProgress) {
        // Looping around
        sProgress = (sProgress + 0.5) % 1.0;
        eProgress = (sProgress + 0.5) % 1.0;
        progress = (progress + 0.5) % 1.0;
      }

      progress = (progress - sProgress) / (eProgress - sProgress);

      const lastFrame =
          animateAvatar(avatarView, frames[startFramePos][1].formatted,
              frames[endFramePos][1].formatted, parsedSeq.rootJointName,
              progress, translate);
      lastFrame.time = now;
      lastFrame.hash = hash;
      lastFrame.speed = speed;
      group.userData.lastFrame = lastFrame;
    }
  }
}

export default AnimationManager;
export {userStateToImplicit, animateEntityImp, animateEntityExp};
