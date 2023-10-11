import { ICharacterClass } from '../../character-class/types';
import { CharacterFeature } from '../character-feature';
import { ClassSubclass } from '../features/character-subclass';
import {
    CharacterFeatureTypes,
    ICharacterFeatureCustomizationOptionWithPage,
} from '../types';

export class ClassFeatureFactory {
    static async construct(
        characterClass: ICharacterClass,
        type: CharacterFeatureTypes,
        options: ICharacterFeatureCustomizationOptionWithPage,
    ): Promise<CharacterFeature> {
        if (type === CharacterFeatureTypes.CHOOSE_SUBCLASS) {
            return new ClassSubclass(characterClass.name);
        }

        return new CharacterFeature(options);
    }

    static parserSpecialCases: {
        [key: string]: { type: CharacterFeatureTypes; pageTitle?: string };
    } = {
        'eldritch invocations': { type: CharacterFeatureTypes.NONE },
        'choose a subclass': {
            type: CharacterFeatureTypes.CHOOSE_SUBCLASS,
        },
        'subclass feature': {
            type: CharacterFeatureTypes.SUBCLASS_FEATURE,
        },
        'feats|feat': { type: CharacterFeatureTypes.FEAT, pageTitle: 'Feats' },
        '#spellcasting': { type: CharacterFeatureTypes.SPELLCASTING },
        '#pact magic': { type: CharacterFeatureTypes.PACT_MAGIC },
    };

    static fromMarkdownString(
        characterClass: ICharacterClass,
        featureText: string,
    ): Promise<CharacterFeature> {
        // Handle special labels
        // eslint-disable-next-line no-restricted-syntax
        for (const [caseText, data] of Object.entries(
            ClassFeatureFactory.parserSpecialCases,
        )) {
            if (featureText.toLowerCase().includes(caseText)) {
                return ClassFeatureFactory.construct(
                    characterClass,
                    data.type,
                    {
                        name: caseText,
                        pageTitle: data.pageTitle,
                    },
                );
            }
        }

        // Remove icons
        if (featureText.startsWith('{{Icon')) {
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            featureText = featureText.split('}} ')[1];
        }

        // Check for SAI style template
        if (featureText.startsWith('{{SAI|')) {
            const parts = featureText.split('|');

            const pageTitle = parts[1].split('}}')[0].trim();

            return ClassFeatureFactory.construct(
                characterClass,
                CharacterFeatureTypes.OTHER,
                {
                    name: pageTitle,
                    pageTitle,
                },
            );
        }

        // Check for SmIconLink style template
        if (featureText.startsWith('{{SmIconLink|')) {
            const parts = featureText.split('|');
            const pageTitle = parts[3].replace('}}', '').trim();

            return ClassFeatureFactory.construct(
                characterClass,
                CharacterFeatureTypes.OTHER,
                {
                    name: pageTitle,
                    pageTitle,
                },
            );
        }

        // Extract link labels or whole links
        const linkPattern = /\[\[(.*?)\]\]/;

        if (linkPattern.test(featureText)) {
            const match = featureText.match(linkPattern);

            if (match) {
                const parts = match[1].split('|');

                // Take the linked page title and discard the non-link text
                return ClassFeatureFactory.construct(
                    characterClass,
                    CharacterFeatureTypes.OTHER,
                    {
                        name: parts[parts.length - 1].trim(),
                        pageTitle: parts[parts.length - 1].trim(),
                    },
                );
            }
        }

        return ClassFeatureFactory.construct(
            characterClass,
            CharacterFeatureTypes.OTHER,
            {
                name: featureText.trim(),
                pageTitle: featureText.trim(),
            },
        );
    }
}
