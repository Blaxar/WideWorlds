<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

// eslint-disable-next-line no-unused-vars
const props = defineProps({
  userInfo: {
    type: Object,
    default: null,
  },
});

</script>

<template>
  <!-- eslint-disable max-len -->
  <table>
    <tbody>
      <tr>
        <td>
          Username:
        </td>
        <td>
          {{ userInfo?.name }}
        </td>
      </tr>
      <tr>
        <td>
          Role:
        </td>
        <td>
          {{ userInfo?.role }}
        </td>
      </tr>
      <tr>
        <td>
          Email:
        </td>
        <td>
          {{ userInfo?.email }}
        </td>
      </tr>
      <tr>
        <td>
          ID:
        </td>
        <td>
          {{ userInfo?.id }}
        </td>
      </tr>
    </tbody>
  </table>
  <!-- eslint-enable max-len -->
</template>

<style scoped>

</style>
