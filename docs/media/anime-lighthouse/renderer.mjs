// Offline authoring only. The app consumes the resulting WebM, never this renderer.
export async function createLighthouseRenderer(canvas, imageUrl) {
  const image = new Image();
  image.src = imageUrl;
  await image.decode();
  const gl = canvas.getContext('webgl', {alpha: false, antialias: false, preserveDrawingBuffer: true});
  if (!gl) throw new Error('WebGL is required for offline lighthouse rendering');
  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
    return result;
  }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, `
    attribute vec2 position;
    varying vec2 uv;
    void main() { uv = (position + 1.0) * .5; gl_Position = vec4(position, 0., 1.); }
  `));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
    precision highp float;
    varying vec2 uv;
    uniform sampler2D painting;
    uniform float phase;
    void main() {
      vec2 p = vec2(uv.x, 1. - uv.y);
      // Do not disturb the fixed rock silhouette, sky, or lighthouse.
      float water = smoothstep(.687, .731, p.y);
      float depth = clamp((p.y - .687) / .313, 0., 1.);
      vec2 q = p;
      q.x += water * (.002 + .003 * depth) *
        (sin(p.y * 122. - phase * 4.) + .42 * sin(p.y * 246. + p.x * 16. + phase * 7.));
      q.y += water * (.001 + .0028 * depth) *
        (sin(p.y * 97. + p.x * 15. - phase * 5.) + .34 * sin(p.y * 174. - p.x * 21. + phase * 8.));
      q = clamp(q, .0005, .9995);
      vec3 color = texture2D(painting, vec2(q.x, 1. - q.y)).rgb;
      float crest = pow(max(0., sin(p.y * 184. + p.x * 15. - phase * 6.)), 8.);
      color += vec3(.022, .014, .050) * crest * water * depth;

      // All layers use integer harmonics of one 24-second clock, including the seam.
      vec2 lamp = vec2(.7045, .487);
      float dx = lamp.x - p.x;
      float beamAngle = -.14 + .18 * sin(phase);
      float beamWidth = .003 + max(dx, 0.) * .046;
      float beamDistance = (p.y - lamp.y - dx * beamAngle) / beamWidth;
      float beam = exp(-beamDistance * beamDistance) * smoothstep(0., .012, dx) *
        (1. - smoothstep(.075, .47, dx));
      float beamStrength = .53 + .24 * cos(phase - .40);
      color += vec3(.18, .14, .15) * beam * beamStrength;
      float glow = exp(-dot((p - lamp) * vec2(99., 68.), (p - lamp) * vec2(99., 68.)));
      color += vec3(.11, .063, .030) * glow * beamStrength;
      float hazeCenter = .621 + .008 * sin(p.x * 9. - phase);
      float hazeDistance = (p.y - hazeCenter) * 36.;
      float haze = exp(-hazeDistance * hazeDistance);
      haze *= 1. - smoothstep(.43, .67, p.x);
      haze *= .20 + .14 * sin(p.x * 20. - phase * 2.) + .04 * cos(p.x * 41. + phase);
      color += vec3(.048, .028, .090) * haze;
      gl_FragColor = vec4(clamp(color, 0., 1.), 1.);
    }
  `));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  const phase = gl.getUniformLocation(program, 'phase');
  gl.viewport(0, 0, canvas.width, canvas.height);
  return seconds => {
    gl.uniform1f(phase, (((seconds % 24) + 24) % 24) * Math.PI / 12);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.finish();
  };
}
