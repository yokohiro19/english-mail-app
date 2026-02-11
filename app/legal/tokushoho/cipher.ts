// TapSmart独自暗号
// XOR + 独自16文字アルファベットによるエンコード
// ソースコード上では意味不明な文字列になり、クライアントJSで復号して表示する

const K = [0x4b,0x72,0x1f,0xa3,0x5e,0x8d,0x31,0xc6,0x07,0x94,0xb2,0x6a,0xf1,0x43,0xd8,0x25];
const A = "qWx7RmKp3vLn8JfZ";

export function decode(c: string): string {
  const r: Record<string, number> = {};
  for (let i = 0; i < A.length; i++) r[A[i]] = i;
  const b: number[] = [];
  for (let i = 0; i < c.length; i += 2) {
    b.push(((r[c[i]] << 4) | r[c[i + 1]]) ^ K[(i / 2) % K.length]);
  }
  return new TextDecoder().decode(new Uint8Array(b));
}

// エンコード用（値を暗号化するときに使う。ブラウザコンソールや Node で実行）
// encode("山田太郎") → 暗号文字列
export function encode(t: string): string {
  const bytes = new TextEncoder().encode(t);
  let o = "";
  for (let i = 0; i < bytes.length; i++) {
    const v = bytes[i] ^ K[i % K.length];
    o += A[v >> 4] + A[v & 0x0f];
  }
  return o;
}
