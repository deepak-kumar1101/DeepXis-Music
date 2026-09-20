const fs = require('fs');
const path = require('path');
const { generateMusicCard } = require('../src/ui/musicCard');

async function testRender() {
  const mockTrack = {
    title: 'Starboy (feat. Daft Punk)',
    author: 'The Weeknd, Daft Punk',
    duration: '03:50',
    durationMS: 230000,
    requestedBy: { username: 'DeepXis' },
    thumbnail: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=640'
  };

  const mockQueue = {
    node: {
      getTimestamp: () => ({ current: { value: 95000 } }),
      volume: 80
    }
  };

  console.log('Rendering music card...');
  const buffer = await generateMusicCard(mockTrack, mockQueue, true);
  const outPath = path.join(__dirname, 'output_card.png');
  fs.writeFileSync(outPath, buffer);
  console.log(`[PASS] Music card successfully rendered: ${outPath} (${buffer.length} bytes)`);
}

testRender().catch(err => {
  console.error('[FAIL] Render error:', err);
  process.exit(1);
});
