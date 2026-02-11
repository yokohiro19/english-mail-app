// エンコード専用ユーティリティ（本番では使われない）
// 鍵はVercel環境変数 CIPHER_KEY / CIPHER_ALPHABET に保存
// 新しい値を暗号化するときだけ Node で実行する:
//   node -e "const{encode}=require('./cipher'); console.log(encode('山田太郎'))"
//
// ※ このファイルはクライアントにバンドルされない

const K = [0x4b,0x72,0x1f,0xa3,0x5e,0x8d,0x31,0xc6,0x07,0x94,0xb2,0x6a,0xf1,0x43,0xd8,0x25];
const A = "qWx7RmKp3vLn8JfZ";

export function encode(t: string): string {
  const bytes = new TextEncoder().encode(t);
  let o = "";
  for (let i = 0; i < bytes.length; i++) {
    const v = bytes[i] ^ K[i % K.length];
    o += A[v >> 4] + A[v & 0x0f];
  }
  return o;
}
