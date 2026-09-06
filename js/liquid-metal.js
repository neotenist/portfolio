import {
  ShaderMount,
  liquidMetalFragmentShader,
  LiquidMetalShapes,
  emptyPixel,
} from 'https://esm.sh/@paper-design/shaders@0.0.80';

function mountLiquidMetal(target) {
  var uniforms = {
    u_colorBack: [0.04, 0.04, 0.06, 0],
    u_colorTint: [0.42, 0.36, 0.92, 1],
    u_image: emptyPixel,
    u_contour: 0.4,
    u_distortion: 0.15,
    u_softness: 0.1,
    u_repetition: 2,
    u_shiftRed: 0.8,
    u_shiftBlue: -0.8,
    u_angle: 90,
    u_isImage: false,
    u_shape: LiquidMetalShapes.none,
    u_fit: 1,
    u_scale: 1,
    u_rotation: 0,
    u_offsetX: 0,
    u_offsetY: 0,
    u_originX: 0.5,
    u_originY: 0.5,
    u_worldWidth: 0,
    u_worldHeight: 0
  };
  return new ShaderMount(target, liquidMetalFragmentShader, uniforms, undefined, 1);
}

window.addEventListener('maxine:activate-shader', function () {
  var target = document.getElementById('shader-mount-target');
  if (!target || target.dataset.mounted) return;
  target.dataset.mounted = '1';
  mountLiquidMetal(target);
}, { once: true });
