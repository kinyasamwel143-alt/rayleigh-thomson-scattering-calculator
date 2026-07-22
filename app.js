(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const form = $("calculator-form");
  const gasSelect = $("gas");
  const customCrossSectionField = $("custom-cross-section-field");
  const validationMessage = $("validation-message");

  const DEFAULTS = Object.freeze({
    energy: 200,
    energyUnit: "1e-3",
    pulseWidth: 1,
    pulseWidthUnit: "1e-9",
    wavelength: 532,
    gas: "air",
    temperature: 20,
    temperatureUnit: "celsius",
    pressure: 101.325,
    pressureUnit: "1000",
    customCrossSection: 5.87,
    length: 20,
    lengthUnit: "0.01",
    solidAngle: 0.01,
    scatteringAngle: 90,
    electronDensity: "1e18",
    opticalTransmission: 100,
    quantumEfficiency: 100,
    mcpGain: "1",
    polarization: "perpendicular",
  });

  const superscripts = {
    "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹"
  };

  function toSuperscript(value) {
    return String(value).split("").map((character) => superscripts[character] || character).join("");
  }

  function scientific(value, digits = 3) {
    if (!Number.isFinite(value)) return "—";
    if (value === 0) return "0";
    const exponent = Math.floor(Math.log10(Math.abs(value)));
    const mantissa = value / (10 ** exponent);
    return `${mantissa.toFixed(digits - 1)} × 10${toSuperscript(exponent)}`;
  }

  function engineering(value, unit) {
    if (!Number.isFinite(value)) return "—";
    if (value === 0) return `0 ${unit}`;

    const prefixes = [
      { threshold: 1e9, scale: 1e9, symbol: "G" },
      { threshold: 1e6, scale: 1e6, symbol: "M" },
      { threshold: 1e3, scale: 1e3, symbol: "k" },
      { threshold: 1, scale: 1, symbol: "" },
      { threshold: 1e-3, scale: 1e-3, symbol: "m" },
      { threshold: 1e-6, scale: 1e-6, symbol: "μ" },
      { threshold: 1e-9, scale: 1e-9, symbol: "n" },
      { threshold: 1e-12, scale: 1e-12, symbol: "p" },
      { threshold: 0, scale: 1e-15, symbol: "f" }
    ];

    const selected = prefixes.find((prefix) => Math.abs(value) >= prefix.threshold);
    const scaled = value / selected.scale;
    const decimals = scaled >= 100 ? 1 : scaled >= 10 ? 2 : 3;
    return `${Number(scaled.toFixed(decimals))} ${selected.symbol}${unit}`;
  }

  function readPositiveNumber(id, label, allowZero = false) {
    const element = $(id);
    const value = Number(element.value);
    const valid = Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
    element.setAttribute("aria-invalid", String(!valid));
    if (!valid) throw new Error(`${label}必须是${allowZero ? "非负" : "大于零的"}数值。`);
    return value;
  }

  function readInput() {
    const energyJ = readPositiveNumber("energy", "单脉冲能量") * Number($("energy-unit").value);
    const pulseWidthS = readPositiveNumber("pulse-width", "脉宽") * Number($("pulse-width-unit").value);
    const wavelengthNm = readPositiveNumber("wavelength", "激光波长");
    const temperatureValue = Number($("temperature").value);
    const temperatureK = $("temperature-unit").value === "celsius"
      ? temperatureValue + 273.15
      : temperatureValue;

    $("temperature").setAttribute("aria-invalid", String(!Number.isFinite(temperatureK) || temperatureK <= 0));
    if (!Number.isFinite(temperatureK) || temperatureK <= 0) {
      throw new Error("温度必须高于绝对零度。 ");
    }

    const pressurePa = readPositiveNumber("pressure", "压强") * Number($("pressure-unit").value);
    const collectionLengthM = readPositiveNumber("length", "散射收集长度") * Number($("length-unit").value);
    const solidAngleSr = readPositiveNumber("solid-angle", "收集立体角");
    const scatteringAngleDeg = readPositiveNumber("scattering-angle", "散射角", true);
    const electronDensityM3 = readPositiveNumber("electron-density", "电子密度", true);
    const opticalTransmissionPercent = readPositiveNumber("optical-transmission", "光路透过率", true);
    const quantumEfficiencyPercent = readPositiveNumber("quantum-efficiency", "量子效率", true);
    const mcpGain = readPositiveNumber("mcp-gain", "MCP 增益");

    if (solidAngleSr > 4 * Math.PI) throw new Error("收集立体角不能超过 4π sr。 ");
    if (scatteringAngleDeg > 180) throw new Error("散射角应在 0° 到 180° 之间。 ");
    if (opticalTransmissionPercent > 100) throw new Error("光路透过率不能超过 100%。 ");
    if (quantumEfficiencyPercent > 100) throw new Error("量子效率不能超过 100%。 ");

    const gasKey = gasSelect.value;
    const crossSection532 = gasKey === "custom"
      ? readPositiveNumber("custom-cross-section", "自定义微分截面") * 1e-32
      : Rayleigh.gases[gasKey].crossSection532;

    return {
      pulseEnergyJ: energyJ,
      pulseWidthS,
      wavelengthNm,
      temperatureK,
      pressurePa,
      collectionLengthM,
      solidAngleSr,
      scatteringAngleDeg,
      electronDensityM3,
      opticalTransmissionFraction: opticalTransmissionPercent / 100,
      quantumEfficiencyFraction: quantumEfficiencyPercent / 100,
      mcpGain,
      polarization: $("polarization").value,
      crossSection532
    };
  }

  function updateResults() {
    try {
      const input = readInput();
      const output = Rayleigh.calculate(input);
      validationMessage.textContent = input.wavelengthNm < 200 || input.wavelengthNm > 2000
        ? "当前波长超出建议估算范围（200–2000 nm），λ⁻⁴ 近似误差可能较大。"
        : "";

      $("scattered-power").textContent = engineering(output.scatteredPower, "W");
      $("instrument-thomson-photon-count").textContent = scientific(output.instrumentThomsonPhotonCount, 3);
      $("thomson-power").textContent = engineering(output.thomsonScatteredPower, "W");
      $("laser-power").textContent = engineering(output.laserPower, "W");
      $("thomson-photon-count").textContent = `${scientific(output.thomsonPhotonCount, 3)} photons/pulse`;
      $("number-density").textContent = `${scientific(output.numberDensity, 3)} m⁻³`;
      $("differential-cross-section").textContent = `${scientific(output.differentialCrossSection, 3)} m²/sr`;
      $("electron-density-output").textContent = `${scientific(input.electronDensityM3, 3)} m⁻³`;
      $("thomson-cross-section").textContent = `${scientific(output.thomsonDifferentialCrossSection, 3)} m²/sr`;
      $("result-context").textContent = `进入 ${input.solidAngleSr} sr 收集立体角的散射信号`;
    } catch (error) {
      validationMessage.textContent = error.message;
    }
  }

  function resetForm() {
    $("energy").value = DEFAULTS.energy;
    $("energy-unit").value = DEFAULTS.energyUnit;
    $("pulse-width").value = DEFAULTS.pulseWidth;
    $("pulse-width-unit").value = DEFAULTS.pulseWidthUnit;
    $("wavelength").value = DEFAULTS.wavelength;
    $("gas").value = DEFAULTS.gas;
    $("temperature").value = DEFAULTS.temperature;
    $("temperature-unit").value = DEFAULTS.temperatureUnit;
    $("pressure").value = DEFAULTS.pressure;
    $("pressure-unit").value = DEFAULTS.pressureUnit;
    $("custom-cross-section").value = DEFAULTS.customCrossSection;
    $("length").value = DEFAULTS.length;
    $("length-unit").value = DEFAULTS.lengthUnit;
    $("solid-angle").value = DEFAULTS.solidAngle;
    $("scattering-angle").value = DEFAULTS.scatteringAngle;
    $("electron-density").value = DEFAULTS.electronDensity;
    $("optical-transmission").value = DEFAULTS.opticalTransmission;
    $("quantum-efficiency").value = DEFAULTS.quantumEfficiency;
    $("mcp-gain").value = DEFAULTS.mcpGain;
    $("polarization").value = DEFAULTS.polarization;
    customCrossSectionField.hidden = true;
    form.querySelectorAll("[aria-invalid]").forEach((element) => element.removeAttribute("aria-invalid"));
    updateResults();
  }

  form.addEventListener("input", updateResults);
  form.addEventListener("change", updateResults);
  gasSelect.addEventListener("change", () => {
    customCrossSectionField.hidden = gasSelect.value !== "custom";
  });
  $("reset-button").addEventListener("click", resetForm);

  updateResults();
})();
