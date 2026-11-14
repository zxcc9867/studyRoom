import {sceneAt} from './scene.mjs';

export async function createSeaRenderer(canvas, imageUrl) {
  const image = new Image();
  image.src = imageUrl;
  await image.decode();
  const gl = canvas.getContext('webgl', {alpha: false, antialias: false, preserveDrawingBuffer: true});
  if (!gl) throw new Error('WebGL is required for offline sea rendering');
  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source); gl.compileShader(result);
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
    uniform vec3 meteor;
    void main() {
      vec2 p = vec2(uv.x, 1. - uv.y);
      float depth = clamp((p.y - .675) / .325, 0., 1.);
      float mask = smoothstep(.675, .70, p.y);
      vec2 samplePoint = p;
      samplePoint.x += mask * pow(depth, .7) * .0030 *
        (sin(p.y * 105. + phase * 4.) + .5 * sin(p.y * 260. - phase * 8. + p.x * 12.));
      samplePoint.y += mask * depth * .0022 *
        (sin(p.x * 10. + p.y * 55. - phase * 6.) + .4 * sin(p.x * 18. + p.y * 175. + phase * 10.));
      samplePoint = clamp(samplePoint, .0005, .9995);
      vec3 color = texture2D(painting, vec2(samplePoint.x, 1. - samplePoint.y)).rgb;
      float crest = pow(max(0., sin(p.y * 190. + p.x * 8. - phase * 8.)), 12.);
      color += vec3(.009, .018, .026) * crest * depth * mask;
      // A short fading trail follows the meteor head; no full-frame flashes.
      vec2 q = p * vec2(1920., 1080.);
      vec2 head = meteor.xy * vec2(1920., 1080.);
      vec2 direction = normalize(vec2(-.25 * 1920., .20 * 1080.));
      vec2 tail = head - direction * 145.;
      vec2 segment = head - tail;
      float along = clamp(dot(q - tail, segment) / dot(segment, segment), 0., 1.);
      float distanceToTrail = length(q - (tail + segment * along));
      float trail = exp(-distanceToTrail * distanceToTrail / 1.8) * pow(along, 1.5);
      float glow = exp(-distanceToTrail * distanceToTrail / 20.) * pow(along, 2.) * .20;
      color += vec3(.65, .79, 1.) * (trail + glow) * meteor.z;
      gl_FragColor = vec4(clamp(color, 0., 1.), 1.);
    }
  `));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  const phase = gl.getUniformLocation(program, 'phase'), meteor = gl.getUniformLocation(program, 'meteor');
  gl.viewport(0, 0, canvas.width, canvas.height);
  return time => {
    const state = sceneAt(time);
    gl.uniform1f(phase, state.phase);
    gl.uniform3f(meteor, state.meteor?.x ?? 0, state.meteor?.y ?? 0, state.meteor?.opacity ?? 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.finish();
  };
}
