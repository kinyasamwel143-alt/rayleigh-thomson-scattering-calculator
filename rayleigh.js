(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.Rayleigh = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BOLTZMANN = 1.380649e-23;
  const PLANCK = 6.62607015e-34;
  const LIGHT_SPEED = 299792458;
  const CLASSICAL_ELECTRON_RADIUS = 2.8179403262e-15;
  const REFERENCE_WAVELENGTH_NM = 532;

  // Differential cross sections at 532 nm, 90 degrees, perpendicular polarization.
  // Units: m^2/sr. Values are intended for engineering estimates.
  const GASES = Object.freeze({
    air: { label: "空气", crossSection532: 5.87e-32 },
    nitrogen: { label: "氮气 N₂", crossSection532: 6.11e-32 },
    oxygen: { label: "氧气 O₂", crossSection532: 5.04e-32 },
    carbonDioxide: { label: "二氧化碳 CO₂", crossSection532: 13.9e-32 },
    hydrogen: { label: "氢气 H₂", crossSection532: 1.33e-32 },
    waterVapor: { label: "水蒸气 H₂O", crossSection532: 4.36e-32 },
    carbonMonoxide: { label: "一氧化碳 CO", crossSection532: 7.84e-32 }
  });

  function angularFactor(angleDegrees, polarization) {
    const radians = angleDegrees * Math.PI / 180;
    const cosSquared = Math.cos(radians) ** 2;

    if (polarization === "parallel") return cosSquared;
    if (polarization === "unpolarized") return (1 + cosSquared) / 2;
    return 1;
  }

  function calculate(input) {
    const temperatureK = input.temperatureK;
    const numberDensity = input.pressurePa / (BOLTZMANN * temperatureK);
    const wavelengthScale = (REFERENCE_WAVELENGTH_NM / input.wavelengthNm) ** 4;
    const angleScale = angularFactor(input.scatteringAngleDeg, input.polarization);
    const differentialCrossSection = input.crossSection532 * wavelengthScale * angleScale;
    const thomsonDifferentialCrossSection = CLASSICAL_ELECTRON_RADIUS ** 2 * angleScale;
    const scatteredFraction = numberDensity * input.collectionLengthM
      * differentialCrossSection * input.solidAngleSr;
    const thomsonScatteredFraction = input.electronDensityM3 * input.collectionLengthM
      * thomsonDifferentialCrossSection * input.solidAngleSr;
    const laserPower = input.pulseEnergyJ / input.pulseWidthS;
    const scatteredEnergy = input.pulseEnergyJ * scatteredFraction;
    const thomsonScatteredEnergy = input.pulseEnergyJ * thomsonScatteredFraction;
    const scatteredPower = laserPower * scatteredFraction;
    const thomsonScatteredPower = laserPower * thomsonScatteredFraction;
    const photonEnergy = PLANCK * LIGHT_SPEED / (input.wavelengthNm * 1e-9);
    const photonCount = scatteredEnergy / photonEnergy;
    const thomsonPhotonCount = input.pulseEnergyJ / photonEnergy
      * input.collectionLengthM * input.solidAngleSr
      * input.electronDensityM3 * thomsonDifferentialCrossSection;
    const instrumentThomsonPhotonCount = thomsonPhotonCount
      * input.opticalTransmissionFraction
      * input.quantumEfficiencyFraction
      * input.mcpGain;

    return {
      numberDensity,
      differentialCrossSection,
      thomsonDifferentialCrossSection,
      scatteredFraction,
      thomsonScatteredFraction,
      laserPower,
      scatteredEnergy,
      thomsonScatteredEnergy,
      scatteredPower,
      thomsonScatteredPower,
      photonCount,
      thomsonPhotonCount,
      instrumentThomsonPhotonCount,
    };
  }

  return {
    constants: {
      BOLTZMANN,
      PLANCK,
      LIGHT_SPEED,
      CLASSICAL_ELECTRON_RADIUS,
      REFERENCE_WAVELENGTH_NM
    },
    gases: GASES,
    angularFactor,
    calculate
  };
});
