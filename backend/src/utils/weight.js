const WEIGHT_TOLERANCE_GRAMS = 20;

/**
 * Convert a product's stored weight into grams.
 *
 * NOTE:
 * - g and kg are true mass measurements.
 * - ml and l are volume measurements and cannot be
 *   converted to grams without knowing product density.
 */
export const toGrams = (weight, unit) => {
  if (!Number.isFinite(weight) || weight < 0) {
    throw new Error("Invalid weight value");
  }

  switch (unit) {
    case "g":
      return weight;

    case "kg":
      return weight * 1000;

    case "ml":
    case "l":
      throw new Error(
        `Cannot convert ${unit} to grams without product density`
      );

    default:
      throw new Error(`Unsupported weight unit: ${unit}`);
  }
};

/**
 * Check whether the sensor weight is within the
 * allowed tolerance of the expected cart weight.
 */
export const isWeightMatch = (
  expectedWeight,
  actualWeight,
  tolerance = WEIGHT_TOLERANCE_GRAMS
) => {
  if (
    !Number.isFinite(expectedWeight) ||
    !Number.isFinite(actualWeight)
  ) {
    return false;
  }

  return Math.abs(expectedWeight - actualWeight) <= tolerance;
};

export { WEIGHT_TOLERANCE_GRAMS };