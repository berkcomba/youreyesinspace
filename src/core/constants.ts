/** Physical & astronomical constants. Internal length unit is kilometres, time is seconds. */
export const AU_KM = 149_597_870.7;
export const LIGHT_YEAR_KM = 9.4607e12;
export const PARSEC_KM = 3.0857e13;
export const G = 6.674e-11; // m^3 kg^-1 s^-2
export const C_KM_S = 299_792.458;
export const DAY_S = 86400;
export const YEAR_D = 365.25;
export const JULIAN_CENTURY_D = 36525;
export const J2000_JD = 2_451_545.0;
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const OBLIQUITY_J2000 = 23.439291 * DEG;
export const SOLAR_LUMINOSITY_W = 3.828e26;
export const STEFAN_BOLTZMANN = 5.670374e-8;

/** Camera / rendering scale constants */
export const CAMERA_NEAR_KM = 1e-3;
export const CAMERA_FAR_KM = 1e13;
export const SKY_RADIUS_KM = 1e12;
