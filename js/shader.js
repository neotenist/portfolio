(function () {
  function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vsSource, fsSource) {
    var vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    var fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  var VERT = [
    'attribute vec2 a_position;',
    'void main() {',
    '  gl_Position = vec4(a_position, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform vec2 u_resolution;',
    'uniform float u_time;',
    'uniform vec2 u_mouse;',
    'uniform float u_intensity;',

    'float hash(vec2 p) {',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
    '}',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  float a = hash(i);',
    '  float b = hash(i + vec2(1.0, 0.0));',
    '  float c = hash(i + vec2(0.0, 1.0));',
    '  float d = hash(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    'float fbm(vec2 p) {',
    '  float v = 0.0;',
    '  float amp = 0.5;',
    '  for (int i = 0; i < 4; i++) {',
    '    v += amp * noise(p);',
    '    p *= 2.02;',
    '    amp *= 0.55;',
    '  }',
    '  return v;',
    '}',

    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / u_resolution.xy;',
    '  vec2 mousePixel = u_mouse * u_resolution;',
    '  float distPx = distance(gl_FragCoord.xy, mousePixel);',
    '  float radiusPx = u_resolution.y * 1.3;',

    /* two-stage domain warp: noise distorting noise, the classic liquid-flow technique */
    '  vec2 st = uv * vec2(3.0, 1.0);',
    '  vec2 v1 = vec2(fbm(st + u_time * 0.05), fbm(st + 4.2 - u_time * 0.04));',
    '  vec2 v2 = vec2(',
    '    fbm(st + 1.4 * v1 + vec2(u_time * 0.09, -u_time * 0.06)),',
    '    fbm(st + 1.4 * v1 + vec2(-u_time * 0.05, u_time * 0.08))',
    '  );',
    '  float n = fbm(st + v2);',

    /* metallic band direction, warped by the flow for the liquid-metal stripe look */
    '  float direction = (uv.x - uv.y) * 3.0 + (v2.x - v2.y) * 2.2 - u_time * 0.15;',

    '  vec3 dark = vec3(0.06, 0.06, 0.08);',
    '  vec3 silver = vec3(0.92, 0.94, 0.97);',
    '  vec3 violet = vec3(0.46, 0.40, 0.86);',
    '  vec3 orange = vec3(1.0, 0.60, 0.28);',

    /* chromatic dispersion: sample the band phase per channel for a chrome edge glint */
    '  float dispersion = 0.035;',
    '  float stripe = fract(direction);',
    '  float stripeR = fract(direction + dispersion);',
    '  float stripeB = fract(direction - dispersion);',

    '  vec3 col = mix(dark, silver, smoothstep(0.0, 0.5, stripe));',
    '  col = mix(col, dark, smoothstep(0.5, 0.55, stripe));',
    '  col = mix(col, silver, smoothstep(0.75, 0.95, stripe));',
    '  col.r = mix(col.r, mix(dark.r, silver.r, smoothstep(0.0, 0.5, stripeR)), 0.6);',
    '  col.b = mix(col.b, mix(dark.b, silver.b, smoothstep(0.0, 0.5, stripeB)), 0.6);',

    '  col = mix(col, violet, smoothstep(0.45, 0.85, v2.x) * 0.45);',
    '  col = mix(col, orange, smoothstep(0.6, 0.95, n) * 0.35);',

    /* organic dissolve: the mask boundary follows the liquid's own noise field instead of fading smoothly */
    '  float dissolveRadius = radiusPx * (0.7 + 0.55 * n);',
    '  float mask = 1.0 - smoothstep(dissolveRadius - 10.0, dissolveRadius + 10.0, distPx);',

    '  gl_FragColor = vec4(col, u_intensity * mask);',
    '}'
  ].join('\n');

  function initShader(canvas) {
    var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return null;

    var program = createProgram(gl, VERT, FRAG);
    if (!program) return null;
    gl.useProgram(program);

    var posLoc = gl.getAttribLocation(program, 'a_position');
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    var uResolution = gl.getUniformLocation(program, 'u_resolution');
    var uTime = gl.getUniformLocation(program, 'u_time');
    var uMouse = gl.getUniformLocation(program, 'u_mouse');
    var uIntensity = gl.getUniformLocation(program, 'u_intensity');

    var mouse = { x: 0.5, y: 0.5 };
    var intensity = 0;
    var targetIntensity = 0;
    var running = true;
    var rafId = null;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(rect.width * dpr));
      var h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function render(t) {
      if (!running) return;
      resize();
      intensity += (targetIntensity - intensity) * 0.08;
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, t * 0.001);
      gl.uniform2f(uMouse, mouse.x, 1.0 - mouse.y);
      gl.uniform1f(uIntensity, intensity);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafId = requestAnimationFrame(render);
    }

    resize();
    rafId = requestAnimationFrame(render);

    return {
      setMouse: function (x, y) { mouse.x = x; mouse.y = y; },
      setActive: function (active) { targetIntensity = active ? 1 : 0; },
      resize: resize,
      destroy: function () {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
      }
    };
  }

  window.MaxineShader = { init: initShader };
})();
