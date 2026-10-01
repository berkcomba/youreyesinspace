import common from './common.glsl?raw';
import lighting from './lighting.glsl?raw';
import surfaceVert from './surface.vert?raw';
import terrestrialFrag from './terrestrial.frag?raw';
import gasgiantFrag from './gasgiant.frag?raw';
import starFrag from './star.frag?raw';
import atmosphereVert from './atmosphere.vert?raw';
import atmosphereFrag from './atmosphere.frag?raw';
import cloudsFrag from './clouds.frag?raw';
import ringsVert from './rings.vert?raw';
import ringsFrag from './rings.frag?raw';
import coronaFrag from './corona.frag?raw';
import billboardVert from './billboard.vert?raw';
import pointsVert from './points.vert?raw';
import pointsFrag from './points.frag?raw';
import starsVert from './stars.vert?raw';
import orbitVert from './orbit.vert?raw';
import orbitFrag from './orbit.frag?raw';
import beltVert from './belt.vert?raw';
import beltFrag from './belt.frag?raw';
import galaxyCloudVert from './galaxycloud.vert?raw';
import galaxyVert from './galaxy.vert?raw';
import galaxyFrag from './galaxy.frag?raw';
import tileVert from './tile.vert?raw';
import tileFrag from './tile.frag?raw';
import blackholeFrag from './blackhole.frag?raw';

/** Compose shader sources with shared chunks. */
export const Shaders = {
  surfaceVert: common + '\n' + surfaceVert,
  tileVert,
  tileFrag: common + '\n' + lighting + '\n' + tileFrag,
  blackholeFrag: common + '\n' + blackholeFrag,
  terrestrialFrag: common + '\n' + lighting + '\n' + terrestrialFrag,
  gasgiantFrag: common + '\n' + lighting + '\n' + gasgiantFrag,
  starFrag: common + '\n' + starFrag,
  atmosphereVert,
  atmosphereFrag: common + '\n' + atmosphereFrag,
  cloudsFrag: common + '\n' + lighting + '\n' + cloudsFrag,
  ringsVert,
  ringsFrag: common + '\n' + lighting + '\n' + ringsFrag,
  coronaFrag: common + '\n' + coronaFrag,
  billboardVert,
  pointsVert,
  pointsFrag,
  starsVert,
  orbitVert,
  orbitFrag,
  beltVert,
  beltFrag,
  galaxyCloudVert,
  galaxyVert,
  galaxyFrag,
};
