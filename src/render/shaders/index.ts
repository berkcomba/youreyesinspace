import common from './common.glsl?raw';
import lighting from './lighting.glsl?raw';
import surfaceVert from './surface.vert?raw';
import terrestrialCommon from './terrestrial_common.glsl?raw';
import cloudsCommon from './clouds_common.glsl?raw';
import terrestrialFrag from './terrestrial.frag?raw';
import gasgiantFrag from './gasgiant.frag?raw';
import starFrag from './star.frag?raw';
import atmosphereVert from './atmosphere.vert?raw';
import atmosphereFrag from './atmosphere.frag?raw';
import cloudsFrag from './clouds.frag?raw';
import ringsVert from './rings.vert?raw';
import ringsFrag from './rings.frag?raw';
import ringRockVert from './ringrock.vert?raw';
import ringRockFrag from './ringrock.frag?raw';
import ringDustVert from './ringdust.vert?raw';
import ringDustFrag from './ringdust.frag?raw';
import plumeVert from './plume.vert?raw';
import cometVert from './comet.vert?raw';
import cometFrag from './comet.frag?raw';
import plumeFrag from './plume.frag?raw';
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
import nebulaCloudVert from './nebulacloud.vert?raw';
import galaxyVert from './galaxy.vert?raw';
import galaxyFrag from './galaxy.frag?raw';
import tileVert from './tile.vert?raw';
import tileFrag from './tile.frag?raw';
import blackholeFrag from './blackhole.frag?raw';
import landmarkVert from './landmark.vert?raw';
import landmarkFrag from './landmark.frag?raw';
import beamVert from './beam.vert?raw';
import beamFrag from './beam.frag?raw';
import meteorVert from './meteor.vert?raw';
import meteorFrag from './meteor.frag?raw';
import terrainVert from './terrain.vert?raw';
import terrainFrag from './terrain.frag?raw';
import depthClearFrag from './depthclear.frag?raw';
import depthFloorVert from './depthfloor.vert?raw';
import panoVert from './pano.vert?raw';
import panoFrag from './pano.frag?raw';
import groundCommon from './ground_common.glsl?raw';
import groundHeightFrag from './groundheight.frag?raw';
import groundAlbedoFrag from './groundalbedo.frag?raw';
import fullscreenVert from './fullscreen.vert?raw';
import volumeVert from './volume.vert?raw';
import volumeCommon from './volume_common.glsl?raw';
import volumeGalaxyFrag from './volume_galaxy.frag?raw';
import volumeNebulaFrag from './volume_nebula.frag?raw';
import volumeCompositeFrag from './volume_composite.frag?raw';

/** Compose shader sources with shared chunks. */
export const Shaders = {
  terrainVert,
  terrainFrag: common + '\n' + terrainFrag,
  depthClearFrag,
  depthFloorVert,
  panoVert,
  panoFrag,
  surfaceVert: common + '\n' + surfaceVert,
  tileVert,
  tileFrag: common + '\n' + lighting + '\n' + cloudsCommon + '\n' + tileFrag,
  blackholeFrag: common + '\n' + blackholeFrag,
  landmarkVert,
  landmarkFrag: common + '\n' + landmarkFrag,
  terrestrialFrag: common + '\n' + lighting + '\n' + terrestrialCommon + '\n' + cloudsCommon + '\n' + terrestrialFrag,
  fullscreenVert,
  volumeVert,
  volumeGalaxyFrag: common + '\n' + volumeCommon + '\n' + volumeGalaxyFrag,
  volumeNebulaFrag: common + '\n' + volumeCommon + '\n' + volumeNebulaFrag,
  volumeCompositeFrag,
  groundHeightFrag: common + '\n' + terrestrialCommon + '\n' + groundCommon + '\n' + groundHeightFrag,
  groundAlbedoFrag: common + '\n' + terrestrialCommon + '\n' + groundCommon + '\n' + groundAlbedoFrag,
  gasgiantFrag: common + '\n' + lighting + '\n' + gasgiantFrag,
  starFrag: common + '\n' + starFrag,
  atmosphereVert,
  atmosphereFrag: common + '\n' + atmosphereFrag,
  cloudsFrag: common + '\n' + lighting + '\n' + cloudsCommon + '\n' + cloudsFrag,
  ringsVert,
  ringsFrag: common + '\n' + lighting + '\n' + ringsFrag,
  ringRockVert: common + '\n' + ringRockVert,
  ringRockFrag: common + '\n' + lighting + '\n' + ringRockFrag,
  ringDustVert: common + '\n' + ringDustVert,
  ringDustFrag: common + '\n' + lighting + '\n' + ringDustFrag,
  plumeVert: common + '\n' + plumeVert,
  cometVert: common + '\n' + cometVert,
  cometFrag: common + '\n' + cometFrag,
  plumeFrag: common + '\n' + lighting + '\n' + plumeFrag,
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
  nebulaCloudVert,
  galaxyVert,
  galaxyFrag,
  beamVert,
  beamFrag,
  meteorVert,
  meteorFrag,
};
