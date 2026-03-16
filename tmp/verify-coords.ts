import proj4 from 'proj4';

const WGS84 = 'EPSG:4326'; // Lat/Lng
const UTM_18S = '+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs';

function utmToLatLng(utm: [number, number]): [number, number] {
  const [lng, lat] = proj4(UTM_18S, WGS84, utm);
  return [lat, lng];
}

const testUtm: [number, number] = [280500.00, 8660000.00];
const [lat, lng] = utmToLatLng(testUtm);

console.log(`UTM: ${testUtm}`);
console.log(`Lat: ${lat}, Lng: ${lng}`);

if (lat < 0 && lng < 0) {
  console.log("SUCCESS: Coordinates are in the correct quadrant for Peru.");
} else {
  console.log("FAILURE: Coordinates are in the wrong quadrant.");
}
