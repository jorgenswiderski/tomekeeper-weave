import { ICharacterChoiceWithStubs } from '@jorgenswiderski/tomekeeper-shared/dist/types/character-feature-customization-option';
import { CharacterFeature } from './character-feature';
import { ICharacterOptionWithPage } from './types';

export class CharacterFeatureCustomizable extends CharacterFeature {
    choices?: ICharacterChoiceWithStubs[];

    constructor(options: ICharacterOptionWithPage) {
        super(options);

        this.choices = options.choices;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            choices: this.choices,
        };
    }
}
