import Phaser from 'phaser';
import { MAPS, validateMap } from '../data/maps';
import { createMonster } from '../data/species';
import { buildAssets } from '../gfx/assets';
import { loadThemeName, THEMES } from '../gfx/palette';

/**
 * Generates all textures for the active theme, seeds save state, then hands off
 * to the overworld. Re-entering this scene is how a theme swap works.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const themeName = this.registry.get('themeName') ?? loadThemeName();
    const theme = THEMES[themeName];
    this.registry.set('themeName', themeName);
    this.registry.set('theme', theme);

    Object.values(MAPS).forEach(validateMap);
    buildAssets(this, theme);

    if (!this.registry.get('party')) {
      this.registry.set('party', [createMonster('sproutle', 5)]);
    }

    this.scene.start('World');
  }
}
