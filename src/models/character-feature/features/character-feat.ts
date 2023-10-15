import { CharacterPlannerStep } from 'planner-types/src/types/character-feature-customization-option';
import {
    GrantableEffect,
    GrantableEffectSubtype,
    GrantableEffectType,
} from 'planner-types/src/types/grantable-effect';
import { error } from '../../logger';
import { MediaWiki } from '../../media-wiki';
import { CharacterFeatureCustomizable } from '../character-feature-customizable';
import { PageLoadingState } from '../../page-item';
import { PageNotFoundError } from '../../errors';
import { CharacterFeature } from '../character-feature';
import { CharacterFeatAbilities } from './character-feat-abilities';

enum SubclassLoadStates {
    CHOICES = 'CHOICES',
}

export class CharacterFeat extends CharacterFeatureCustomizable {
    constructor() {
        super({
            name: `Feat`,
            pageTitle: 'Feats',
            choiceType: CharacterPlannerStep.FEAT,
        });

        this.initialized[SubclassLoadStates.CHOICES] =
            this.initChoices().catch(error);
    }

    private async initChoices(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page?.content) {
            throw new PageNotFoundError();
        }

        const featPattern =
            /\|{{anchor\|([^}]+)}} '''(.*?)'''[^|]*?\|\|([\s\S]*?)(?=\|-\n|\|-|$)/g;
        const grantPattern = /[^*]\s*'''{{SAI\|(.*?)\|/g;
        const choicePattern = /\*\s*'''{{SAI\|(.*?)[|}]/g;

        const abilityImprovementPatterns = [
            /Your\s+{{Ability\|(\w+)}}\s+or\s+{{Ability\|(\w+)}}\s+increases\s+by\s+(\d+)/, // Matches: "Your Strength or Dexterity increases by 1"
            /Increase your\s+{{Ability\|(\w+)}}\s+or\s+{{Ability\|(\w+)}}\s+by\s+(\d+)/, // Matches: "Increase your Strength or Dexterity by 1"
            /Increase\s+your\s+{{Ability\|(\w+)}}\s+by\s+(\d+)/, // Matches: "Increase your Strength by 1"
            /{{Ability\|(\w+)}}\s+increases\s+by\s+(\d+)/, // Matches: "Your Charisma increases by 1"
        ];

        const feats: {
            [key: string]: {
                grants: string[];
                choices: string[];
                description: string;
                abilityImprovement?: {
                    abilities: string[];
                    points: number;
                };
            };
        } = {};

        Array.from(this.page.content.matchAll(featPattern)).forEach((match) => {
            const featName = match[2].trim();
            const grants: string[] = [];
            const choices: string[] = [];
            let abilityImprovement: {
                abilities: string[];
                points: number;
            } | null = null;

            Array.from(match[3].matchAll(grantPattern)).forEach(
                (abilityMatch) => {
                    grants.push(abilityMatch[1].trim());
                },
            );

            Array.from(match[3].matchAll(choicePattern)).forEach(
                (abilityMatch) => {
                    choices.push(abilityMatch[1].trim());
                },
            );

            if (
                featName === 'Ability Improvement' ||
                featName === 'Resilient'
            ) {
                abilityImprovement = {
                    abilities: [
                        'Strength',
                        'Dexterity',
                        'Constitution',
                        'Intelligence',
                        'Wisdom',
                        'Charisma',
                    ],
                    points: featName === 'Ability Improvement' ? 2 : 1,
                };
            } else {
                abilityImprovementPatterns.forEach((pattern) => {
                    if (abilityImprovement) {
                        return;
                    }

                    const abilityImprovementMatch = match[3].match(pattern);

                    if (abilityImprovementMatch) {
                        const abilities = abilityImprovementMatch.slice(1, -1); // Exclude the last group which is the amount
                        const points = parseInt(
                            abilityImprovementMatch[
                                abilityImprovementMatch.length - 1
                            ],
                            10,
                        );

                        if (abilities?.length > 0) {
                            abilityImprovement = {
                                abilities,
                                points,
                            };
                        }
                    }
                });
            }

            feats[featName] = {
                grants,
                choices,
                description: MediaWiki.stripMarkup(match[3]).trim(),
                abilityImprovement: abilityImprovement ?? undefined,
            };
        });

        this.choices = [
            await Promise.all(
                Object.entries(feats).map(async ([name, data]) => {
                    const {
                        grants,
                        choices: choiceTitles,
                        description,
                        abilityImprovement,
                    } = data;
                    const fx = (
                        await Promise.all(
                            grants.map((pageTitle) =>
                                CharacterFeature.parsePageForGrantableEffect(
                                    pageTitle,
                                ),
                            ),
                        )
                    ).filter(Boolean) as GrantableEffect[];

                    const choices = choiceTitles.map(
                        (title) =>
                            new CharacterFeature({
                                pageTitle: title,
                                name: CharacterFeature.parseNameFromPageTitle(
                                    title,
                                ),
                            }),
                    );

                    if (fx.length === 0 && choices.length === 0) {
                        fx.push({
                            name: CharacterFeature.parseNameFromPageTitle(name),
                            description,
                            type: GrantableEffectType.CHARACTERISTIC,
                        });
                    }

                    if (abilityImprovement) {
                        if (abilityImprovement.abilities.length > 1) {
                            choices.push(
                                new CharacterFeatAbilities(
                                    {
                                        name,
                                    },
                                    abilityImprovement.abilities,
                                    abilityImprovement.points,
                                ),
                            );
                        } else {
                            fx.push({
                                name: `${CharacterFeature.parseNameFromPageTitle(
                                    name,
                                )}: ${abilityImprovement.abilities[0]}`,
                                type: GrantableEffectType.CHARACTERISTIC,
                                subtype: GrantableEffectSubtype.ABILITY_FEAT,
                                values: {
                                    [abilityImprovement.abilities[0]]:
                                        abilityImprovement.points,
                                },
                                // description: `Increases your ${abilityImprovement.abilities[0]} by ${abilityImprovement.points}.`,
                                hidden: true,
                            });
                        }
                    }

                    return {
                        name,
                        description,
                        image:
                            fx.find((effect) => effect.image)?.image ??
                            MediaWiki.getImagePath(
                                'PassiveFeature Generic.png',
                            ),
                        grants: fx,
                        type: CharacterPlannerStep.FEAT,
                        choiceType:
                            choices?.length > 0
                                ? CharacterPlannerStep.FEAT_SUBCHOICE
                                : undefined,
                        choices: choices?.length > 0 ? [choices] : undefined,
                    };
                }),
            ),
        ];
    }
}
