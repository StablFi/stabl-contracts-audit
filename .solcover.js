module.exports = {
  skipFiles: [
    "mocks", // Testing
    "crytic", // Testing
    "token/CASHResolutionUpgrade.sol", // No longer used
    "oracle/MixOracle.sol", // No longer used
    "vault/VaultInitializer.sol", // No longer used
    "utils/StableMath.sol", // Library
  ],
  configureYulOptimizer: true
};
