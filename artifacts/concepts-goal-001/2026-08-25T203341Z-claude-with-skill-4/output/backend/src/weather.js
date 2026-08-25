/**
 * The actual product. Stubbed — this repo is about the billing, not the meteorology. Swap in
 * whatever model or upstream you already use.
 */
export async function getForecast(lat, lon) {
  const day = Math.floor(Date.now() / 86_400_000);
  const seed = Math.abs(Math.round(lat * 1000) ^ Math.round(lon * 1000) ^ day);
  return {
    lat,
    lon,
    generatedAt: new Date().toISOString(),
    forecast: Array.from({length: 3}, (_, i) => ({
      dayOffset: i,
      tempC: 8 + ((seed + i * 7) % 22),
      conditions: ["clear", "cloudy", "rain", "snow"][(seed + i) % 4],
    })),
  };
}
