/**
 * DeepXis Music Bot - Interactive Discord Select Menus
 * Strictly NO Unicode emojis.
 */

const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

/**
 * Creates select menu for search results
 * @param {Array<{ title: string, artist: string, url: string }>} tracks 
 */
function createSearchSelectMenu(tracks) {
  const options = tracks.slice(0, 10).map((t, idx) => {
    const title = t.title.length > 50 ? t.title.substring(0, 47) + '...' : t.title;
    const artist = (t.artist || 'Unknown').length > 50 ? (t.artist || 'Unknown').substring(0, 47) + '...' : (t.artist || 'Unknown');

    return new StringSelectMenuOptionBuilder()
      .setLabel(`${idx + 1}. ${title}`)
      .setDescription(`Artist: ${artist}`)
      .setValue(String(idx));
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('menu_search_select')
    .setPlaceholder('Select a track to play...')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(menu);
}

/**
 * Creates loop mode select menu
 * @param {number} currentMode 0 = off, 1 = track, 2 = queue, 3 = autoplay
 */
function createLoopSelectMenu(currentMode = 0) {
  const options = [
    new StringSelectMenuOptionBuilder()
      .setLabel('Loop Off')
      .setDescription('Disable loop mode')
      .setValue('0')
      .setDefault(currentMode === 0),
    new StringSelectMenuOptionBuilder()
      .setLabel('Loop Track')
      .setDescription('Repeat the currently playing track')
      .setValue('1')
      .setDefault(currentMode === 1),
    new StringSelectMenuOptionBuilder()
      .setLabel('Loop Queue')
      .setDescription('Repeat the entire server queue')
      .setValue('2')
      .setDefault(currentMode === 2),
    new StringSelectMenuOptionBuilder()
      .setLabel('Autoplay')
      .setDescription('Automatically play related tracks when queue ends')
      .setValue('3')
      .setDefault(currentMode === 3)
  ];

  const menu = new StringSelectMenuBuilder()
    .setCustomId('menu_loop_select')
    .setPlaceholder('Choose loop mode...')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  createSearchSelectMenu,
  createLoopSelectMenu
};
