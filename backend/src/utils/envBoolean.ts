const truthyEnvValues = new Set(["true", "1", "yes", "on"]);
const falsyEnvValues = new Set(["false", "0", "no", "off", ""]);

export const parseBooleanEnvValue = (value: unknown) => {
  if (value === undefined || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (truthyEnvValues.has(normalizedValue)) {
      return true;
    }

    if (falsyEnvValues.has(normalizedValue)) {
      return false;
    }
  }

  return value;
};
