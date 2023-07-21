/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

const lineHeightRatio = 1.2;
const maxCharSizeRatio = 0.333;
const fontCharRatio = 0.6;
const fontSpaceRatio = 0.4;

/**
 * Format raw text into displayable HTML content
 * @param {string} rawText - Input text to format.
 * @return {string} HTML version of the input text.
 */
function rawTextToHTML(rawText) {
  return rawText.replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll('\'', '&#039;')
      .replaceAll('\n\r', '<br/>')
      .replaceAll('\n', '<br/>');
}

/**
 * Guess the width of a single line of text for HTML sign rendering
 * @param {string} line - Text content to mesure.
 * @param {integer} fontSize - Font size, in pixels.
 * @return {integer} Width of the text, in pixels.
 */
function mesureLineHTML(line, fontSize) {
  let width = 0;
  const charSize = fontSize * fontCharRatio;
  const spaceSize = fontSize * fontSpaceRatio;

  for (const char in line) {
    if (char === ' ') width += spaceSize;
    else width += charSize;
  }

  return width;
}

/**
 * Mesure the width of a single line of text for bare canvas sign rendering
 * @param {string} line - Text content to mesure.
 * @param {integer} fontSize - Font size, in pixels.
 * @param {canvas} canvasCtx - 2D HTML canvas context.
 * @return {integer} Width of the text, in pixels.
 */
function mesureLineCanvas(line, fontSize, canvasCtx) {
  canvasCtx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
  return canvasCtx.measureText(line).width;
}

/**
 * Format text into an array of lines for it to fit into a given surface
 * @param {string} text - Text content to format.
 * @param {integer} width - Width of the canvas, in pixels.
 * @param {integer} height - Height of the canvas, in pixels.
 * @param {function} mesureLine - Function to use for line mesurement,
 *                                see {@link mesureLineHTML} and
 *                                {@link mesureLineCanvas}.
 * @return {Object} Object holding lines, fontSize (in pixels) and
 *                  maxLineWidth (in pixels)
 */
function formatSignLines(text, width, height, mesureLine) {
  const finalText = text.replaceAll('\r\n', '\n').trim();

  const maxSpan = width > height ? width : height;

  const surface = width * height;
  let fontSize = parseInt(Math.sqrt(surface / text.length) * 1.2);

  if (!finalText.length) return {lines: [''], fontSize, maxLineWidth: width};

  if (fontSize > maxSpan * maxCharSizeRatio) {
    fontSize = parseInt(maxSpan * maxCharSizeRatio);
  }

  let lineHeight = 0;
  let maxLineWidth = 0;
  let lines = [''];

  // Look for naturally-occuring line breaks
  const tmpLines = finalText.split('\n');

  // Find a fitting font size
  do {
    lineHeight = parseInt(fontSize * lineHeightRatio);
    maxLineWidth = 0;
    let currentLineId = 0;
    lines = [''];
    let retry = false;

    const startNewLine = () => {
      const newWidth = getNewLineWidth();
      if (newWidth > maxLineWidth) maxLineWidth = newWidth;
      lines[currentLineId] = lines[currentLineId].trim();
      lines.push('');
      currentLineId++;
    };

    const getNewLineWidth = (newWord = '') => {
      const fullLine = (lines[currentLineId] + newWord).trim();
      return mesureLine(fullLine, fontSize);
    };

    // Try to fit the text in the canvas
    for (const tmpLine of tmpLines) {
      for (const word of tmpLine.split(' ')) {
        if (mesureLine(word, fontSize) > width) {
          // Retry right away if the word itself is too big
          // for the container
          retry = true;
          break;
        }

        if (getNewLineWidth(word) > width) {
          startNewLine();
        }

        lines[currentLineId] += `${word} `;

        if (lines.length * lineHeight > height) {
          // Too many lines overflowing on the height: try a smaller font
          // size
          retry = true;
          break;
        }
      }

      if (retry) break;
      startNewLine();
    }

    if (retry) continue;

    // At this point: we're out of words to dispatch and yet everything fits:
    // this simply means we can stop
    lines[currentLineId] = lines[currentLineId].trim();
    if (!lines[currentLineId].length) lines.length--;

    break;
  } while (--fontSize > 0);

  return {lines, fontSize, maxLineWidth};
}

/**
 * Make the whole HTML content for the sign to be displayed
 * @param {Array<string>} lines - Text lines ti display.
 * @param {integer} fontSize - Font size, in pixels.
 * @param {integer} width - Width of the canvas, in pixels.
 * @param {integer} height - Height of the canvas, in pixels.
 * @param {integer} r - Red component of the text color (from 0 to 255).
 * @param {integer} g - Green component of the text color (from 0 to 255).
 * @param {integer} b - Blue component of the text color (from 0 to 255).
 * @return {string} HTML content to be displayed.
 */
function makeSignHTML(lines, fontSize, width, height, r = 0, g = 0, b = 0) {
  const finalText = lines.join('\n');
  const lineHeight = parseInt(fontSize * lineHeightRatio);
  const spanHeight = lineHeight * lines.length;
  const marginTop = (height - spanHeight) / 2;

  return `<body style="` +
    `color:rgb(${r},${g},${b});` +
    `text-align:center;` +
    `font-family:Arial,Helvetica,sans-serif;` +
    `margin:0;padding:0;font-size:${fontSize}px;` +
    `width:${width}px;height:${height}px;` +
    `line-height:${lineHeight}px;` +
    `"><span style="display:inline-block;` +
    `margin-top:${marginTop}px;` +
    `height:${spanHeight}px;` +
    `white-space:nowrap;font-weight:500;padding:0;` +
    `vertical-align:middle;">${rawTextToHTML(finalText)}</span></body>`;
}

/**
 * Draw text content on the provided canvas
 * @param {canvas} canvasCtx - 2D HTML canvas context to draw with.
 * @param {Array<string>} lines - Text lines ti display.
 * @param {integer} fontSize - Font size, in pixels.
 * @param {integer} width - Width of the canvas, in pixels.
 * @param {integer} height - Height of the canvas, in pixels.
 * @param {integer} maxLineWidth - Maximum line width, in pixels.
 * @param {integer} r - Red component of the text color (from 0 to 255).
 * @param {integer} g - Green component of the text color (from 0 to 255).
 * @param {integer} b - Blue component of the text color (from 0 to 255).
 */
function makeSignCanvas(canvasCtx, lines, fontSize, width, height, maxLineWidth,
    r = 0, g = 0, b = 0) {
  canvasCtx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
  canvasCtx.fillStyle = `rgb(${r},${g},${b})`;
  canvasCtx.textBaseline = 'top';

  const lineHeight = parseInt(fontSize * lineHeightRatio);
  const spanHeight = lineHeight * lines.length;
  const marginTop = (height - spanHeight) / 2;
  const marginLeft = (width - maxLineWidth) / 2;

  lines.forEach((line, i) => {
    const leftOffset = (maxLineWidth - canvasCtx.measureText(line).width) / 2;
    const topOffset = i * lineHeight;
    canvasCtx.fillText(line, marginLeft + leftOffset, marginTop + topOffset);
  });
}

export default formatSignLines;
export {rawTextToHTML, mesureLineHTML, mesureLineCanvas, makeSignHTML,
  makeSignCanvas};
