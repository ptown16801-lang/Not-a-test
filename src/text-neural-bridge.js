import { textToPerceptualVector } from './text-perception.js';
import { neuralResponseToShape } from './neural-shape-bridge.js';

export const TEXT_NEURAL_BRIDGE_SCHEMA='text-neural-bridge/v1';

/**
 * End-to-end text projection into the existing recurrent population model.
 * Text is first converted to perceptual dimensions and semantic populations;
 * object nouns are never converted directly into literal geometry.
 */
export function projectTextThroughNetwork(text,network,{response={},projection={}}={}){
  if(!network?.respond)throw new TypeError('network must provide respond(input, options)');
  const perception=textToPerceptualVector(text);
  const settled=network.respond(perception.input,response);
  const projected=neuralResponseToShape(network,settled,projection);
  return Object.freeze({
    schema:TEXT_NEURAL_BRIDGE_SCHEMA,
    sourceText:text,
    perception,
    ...projected,
    stimulus:Object.freeze({
      modalities:perception.modalities,
      encoding:perception.encoding,
      dimensions:perception.dimensions,
      quantity:perception.quantity,
      quantitySalience:perception.quantitySalience,
      semanticPopulations:perception.populations
    })
  });
}
