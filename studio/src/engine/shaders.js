// Shader GLSL ES 3.0 del motore.

export const VERT = `#version 300 es
in vec2 aPos;
uniform float uFlipY;
out vec2 vUV;
void main() {
  vUV = vec2(aPos.x * 0.5 + 0.5, mix(aPos.y * 0.5 + 0.5, 0.5 - aPos.y * 0.5, uFlipY));
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Sfocatura gaussiana separabile su colori premoltiplicati per la maschera della pelle:
// il risultato diviso per l'alfa è la media dei soli pixel di pelle (nessun alone da occhi o capelli).
export const BLUR = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform sampler2D uMask;
uniform bool uFirst;
uniform vec2 uDir;     // passo di un pixel nella direzione della passata
uniform float uSigma;
out vec4 o;
vec4 fetch(vec2 uv) {
  if (uFirst) { float m = texture(uMask, uv).a; return vec4(texture(uSrc, uv).rgb * m, m); }
  return texture(uSrc, uv);
}
void main() {
  int r = int(ceil(uSigma * 3.0));
  vec4 acc = vec4(0.0); float wsum = 0.0;
  for (int i = -96; i <= 96; i++) {
    if (i < -r || i > r) continue;
    float w = exp(-float(i * i) / (2.0 * uSigma * uSigma));
    acc += fetch(vUV + uDir * float(i)) * w;
    wsum += w;
  }
  o = acc / wsum;
}`;

export const MAIN = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUV;
uniform sampler2D uOrig, uBlur1, uBlur2, uMaskA, uMaskB, uShade, uGlow, uFreck, uHandles, uMaskC;
uniform int uNH;
uniform vec2 uRes;
uniform bool uShowOriginal;
// Pelle
uniform float uTan, uTanTone, uSmooth, uEven, uRedness, uPores, uBright, uRadiance, uTone;
uniform float uFreckInt;
uniform vec3 uSkinMean;     // colore medio della pelle (bassa frequenza)
// Tratti (chiaroscuro)
uniform float uCheekDef, uCheekVol, uSculpt, uJawDef, uNoseDef, uContour, uLipVol, uBrowThick, uPeri;
uniform float uEyeDef, uBrowDef, uLipDef;
out vec4 o;

vec2 disp(vec2 q) {
  vec2 d = vec2(0.0);
  for (int i = 0; i < 256; i++) {
    if (i >= uNH) break;
    vec4 h0 = texelFetch(uHandles, ivec2(0, i), 0); // cx, cy, a, b
    vec4 h1 = texelFetch(uHandles, ivec2(1, i), 0); // cos, sin, 1/rx, 1/ry
    float typ = texelFetch(uHandles, ivec2(2, i), 0).x;
    vec2 p = q - h0.xy;
    vec2 l = vec2(p.x * h1.x + p.y * h1.y, -p.x * h1.y + p.y * h1.x);
    vec2 n = l * h1.zw;
    float u2 = dot(n, n);
    if (u2 >= 1.0) continue;
    float t = 1.0 - u2; float k = t * t * t;
    if (typ < 0.5) d += h0.zw * k;
    else {
      vec2 s = l * h0.zw * k;
      d += vec2(s.x * h1.x - s.y * h1.y, s.x * h1.y + s.y * h1.x);
    }
  }
  return d;
}

vec3 rgb2ycc(vec3 c) { return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(-0.1687, -0.3313, 0.5)), dot(c, vec3(0.5, -0.4187, -0.0813))); }
vec3 ycc2rgb(vec3 y) { return vec3(y.x + 1.402 * y.z, y.x - 0.344136 * y.y - 0.714136 * y.z, y.x + 1.772 * y.y); }
vec3 unprem(vec4 b, vec3 fallback) { return b.a > 0.002 ? b.rgb / b.a : fallback; }
// Schiarisce conservando tinta e saturazione: guadagno moltiplicativo con compressione morbida delle alte luci
// (aggiungere bianco renderebbe grigiastre le carnagioni scure).
vec3 lighten(vec3 c, float k) {
  if (k <= 0.0) return c * (1.0 + k);
  vec3 g = c * (1.0 + k * 1.6);
  return mix(g, 1.0 - (1.0 - c) * (1.0 - k), smoothstep(0.55, 1.0, g)); // vicino al bianco torna allo schermo
}

void main() {
  vec2 x = vUV * uRes;
  vec2 src = x;
  if (uNH > 0) {
    // Inversione della mappa x = q + D(q) con iterazioni di punto fisso.
    src = x - disp(x);
    src = x - disp(src);
    src = x - disp(src);
  }
  vec2 uv = src / uRes;
  vec3 C = texture(uOrig, uv).rgb;
  if (uShowOriginal) { o = vec4(texture(uOrig, vUV).rgb, 1.0); return; }

  vec4 mA = texture(uMaskA, uv), mB = texture(uMaskB, uv), sh = texture(uShade, uv), gl = texture(uGlow, uv);
  float skinF = mA.r;                        // pelle del viso
  float skinAll = max(mB.r, skinF);          // viso + corpo
  float notFeature = (1.0 - mA.g) * (1.0 - mA.b) * (1.0 - mB.g) * (1.0 - mB.b);

  // Separazione in frequenze, solo su pelle: L basse, M medie (macchie, discromie), F fini (pori).
  vec3 B1 = unprem(texture(uBlur1, uv), C);
  vec3 B2 = unprem(texture(uBlur2, uv), C);
  vec3 F = C - B1, M = B1 - B2, L = B2;

  // Texture e imperfezioni: le macchie scure (M negativo) si attenuano più di quelle chiare.
  float skinT = skinF * notFeature;          // pelle lontana da occhi, labbra e capelli
  float sm = uSmooth * skinT;
  float darkSpot = clamp(-dot(M, vec3(0.333)) * 12.0, 0.0, 1.0);
  M *= 1.0 - sm * mix(0.5, 0.92, darkSpot);
  F *= clamp(1.0 - sm * 0.15 + uPores * skinT * 0.7, 0.0, 2.0);

  // Uniformità e rossori lavorano sulla bassa frequenza in YCbCr.
  vec3 ly = rgb2ycc(L), my = rgb2ycc(uSkinMean);
  float ev = uEven * skinT;
  ly.yz = mix(ly.yz, my.yz, ev * 0.55);
  ly.x = mix(ly.x, ly.x + (my.x - ly.x) * 0.25, ev);
  float red = uRedness * skinT;
  float excess = max(0.0, ly.z - my.z);
  ly.z -= excess * red * 0.85;
  vec3 Ly = ycc2rgb(ly);
  vec3 my2 = rgb2ycc(M); my2.z -= max(0.0, my2.z) * red * 0.8; // rossori locali (brufoli, capillari)
  C = Ly + ycc2rgb(my2) + F;

  // Lentiggini: si integrano con la grana della pelle e prendono il colore dalla pelle stessa.
  float fr = texture(uFreck, uv).r * uFreckInt * skinF;
  fr *= clamp(1.0 + dot(F, vec3(0.333)) * 4.0, 0.4, 1.4);
  C *= mix(vec3(1.0), vec3(0.83, 0.70, 0.6), clamp(fr, 0.0, 1.0));

  // Chiaroscuro dei tratti (zigomi, mandibola, naso, contorno): solo luminanza, solo sulla pelle.
  float shadow = uCheekDef * sh.r * 0.16 + uSculpt * sh.r * 0.26 + uJawDef * sh.b * 0.2
               + uNoseDef * sh.a * 0.14 + uContour * (sh.r * 0.1 + sh.b * 0.14);
  float light = uCheekDef * sh.g * 0.08 + uCheekVol * sh.g * 0.12 + uSculpt * sh.g * 0.06;
  shadow *= skinF; light *= skinF;
  C *= 1.0 - clamp(shadow, -0.35, 0.45);
  C = lighten(C, clamp(light, -0.3, 0.3));
  // Zona perioculare: schiarisce le occhiaie (o le accentua con valori negativi).
  C = lighten(C, uPeri * mB.a * skinF * 0.22);
  // Labbra: luce sul labbro inferiore che accompagna il volume.
  C = lighten(C, uLipVol * gl.a * mA.g * 0.14);
  // Sopracciglia più sottili: i bordi tendono al colore della pelle vicina.
  if (uBrowThick < 0.0) C = mix(C, L, -uBrowThick * mA.a * 0.45);
  else C *= 1.0 - uBrowThick * mA.a * 0.12;

  // Definizione di sguardo, sopracciglia e labbra: lavora sui toni già presenti (scurisce o aumenta il contrasto),
  // non aggiunge colori. Con valori negativi ammorbidisce.
  vec4 mC = texture(uMaskC, uv);
  C *= 1.0 - clamp(uEyeDef * mC.r * 0.38, -0.3, 0.5);                 // linea delle ciglia
  if (uEyeDef > 0.0) C = mix(C, (C - 0.45) * 1.25 + 0.47, min(uEyeDef, 1.0) * mC.b * 0.5); // contrasto di iride e sclera
  C *= 1.0 - 0.35 * clamp(uBrowDef, -1.0, 1.0) * mA.a;                 // sopracciglia più piene (o più leggere)
  C *= 1.0 - clamp(uLipDef * mC.g * 0.16, -0.2, 0.25);                 // contorno labbra
  C = lighten(C, uLipDef * gl.a * mA.g * 0.1);

  // Luce: luminosità della pelle, radiosità sulle zone in rilievo, sottotono.
  float lum = dot(C, vec3(0.299, 0.587, 0.114));
  C = lighten(C, uBright * skinAll * 0.3 * notFeature);
  C = lighten(C, uRadiance * gl.r * skinF * (0.12 + lum * 0.18));
  C += uTone * skinAll * notFeature * vec3(0.022, 0.004, -0.026);

  // Abbronzatura: moltiplicativa (conserva ombre e texture), solo su pelle; mai occhi, denti, capelli, sfondo.
  float tm = skinAll * notFeature;
  vec3 warm = vec3(0.86, 0.72, 0.58), cool = vec3(0.81, 0.74, 0.68);
  vec3 tanTint = mix(cool, warm, uTanTone * 0.5 + 0.5);
  if (uTan > 0.0) C *= mix(vec3(1.0), tanTint, uTan * tm);
  else if (uTan < 0.0) C = mix(C, lighten(C, 0.22 * -uTan) * vec3(1.0, 0.995, 0.985), tm);

  o = vec4(clamp(C, 0.0, 1.0), 1.0);
}`;
