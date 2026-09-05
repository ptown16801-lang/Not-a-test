import { installCloudLoop } from './cloud-loop.js';
import { installCornBreezeFrom } from './corn-breeze.js';

/**
 * Attach ambient motion to a cornfield scene without changing artwork.
 * Expected hooks:
 *   cloud layer: [data-cloud-layer] or .cloud-layer
 *   corn stalks/groups: [data-corn-stalk] or .corn-stalk
 * Missing hooks are tolerated so the module can be installed before artwork.
 */
export function installEnvironmentMotion(root=document, options={}) {
  const cloud = root.querySelector('[data-cloud-layer], .cloud-layer');
  const cloudController = cloud ? installCloudLoop(cloud, options.clouds) : null;
  const cornController = installCornBreezeFrom(root, '[data-corn-stalk], .corn-stalk', options.corn);

  return {
    cloudAttached: Boolean(cloudController),
    cornCount: root.querySelectorAll('[data-corn-stalk], .corn-stalk').length,
    pause() { cloudController?.pause?.(); cornController.pause(); },
    play() { cloudController?.play?.(); cornController.play(); },
    destroy() { cloudController?.destroy?.(); cornController.destroy(); }
  };
}
