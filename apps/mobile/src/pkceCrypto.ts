type NativeCrypto = {
  getRandomValues?: (array: Uint32Array) => Uint32Array;
  subtle?: { digest: (algorithm: string, data: BufferSource) => Promise<ArrayBuffer> };
};

// Hermes provides TextEncoder; expo-crypto supplies the missing native WebCrypto operations.
// Without these auth-js would use Math.random and/or plain PKCE in React Native.
export function installNativePKCECrypto(host: { crypto?: NativeCrypto }, ports: {
  getRandomValues: (array: Uint32Array) => Uint32Array;
  digest: (data: BufferSource) => Promise<ArrayBuffer>;
}) {
  const crypto = host.crypto ?? {};
  crypto.getRandomValues ??= ports.getRandomValues;
  crypto.subtle ??= { digest: async (algorithm, data) => {
    if (algorithm !== "SHA-256") throw new Error("Unsupported crypto algorithm");
    return ports.digest(data);
  } };
  host.crypto = crypto;
}
