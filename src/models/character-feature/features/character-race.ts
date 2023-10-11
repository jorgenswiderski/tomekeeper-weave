import {
    CharacterPlannerStep,
    ICharacterFeatureCustomizationOption,
} from 'planner-types/src/types/character-feature-customization-option';
import { MwnApi } from '../../../api/mwn';
import { error } from '../../logger';
import { MediaWiki } from '../../media-wiki';
import { PageLoadingState } from '../../page-item';
import {
    CharacterFeatureTypes,
    ICharacterFeatureCustomizationOptionWithPage,
} from '../types';
import { CharacterSubrace } from './character-subrace';
import { CharacterFeature } from '../character-feature';

export interface RaceInfo extends ICharacterFeatureCustomizationOption {
    name: string;
    description: string;
    choices?: CharacterSubrace[][];
    choiceType?: CharacterPlannerStep.CHOOSE_SUBRACE;
    image?: string;
}

enum RaceLoadState {
    CHOICES = 'CHOICES',
}

export class CharacterRace extends CharacterFeature {
    choices?: CharacterSubrace[][];
    type: CharacterFeatureTypes.RACE = CharacterFeatureTypes.RACE;

    constructor(options: ICharacterFeatureCustomizationOptionWithPage) {
        super(options);

        this.initialized[RaceLoadState.CHOICES] =
            this.initChoices().catch(error);
    }

    private async initChoices(): Promise<void> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            throw new Error('Could not find page content');
        }

        const subracePattern = /\n===\s*([^=]*?)\s*===\n\s*([\s\S]*?)(?===|$)/g;

        let match;
        const choices: CharacterSubrace[][] = [[]];

        while (true) {
            match = subracePattern.exec(this.page.content);
            if (!match) break;

            choices[0].push(new CharacterSubrace(match[1], match[2].trim()));
        }

        if (choices.flat().length) {
            this.choices = choices;
        }
    }

    private async getImage(): Promise<string | null> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            throw new Error('Could not find page content');
        }

        const regex = /\[\[File\s*:\s*([^|\]]+).*|right]]/m;
        const match = regex.exec(this.page.content);

        if (!match || !match[1]) {
            return null;
        }

        const fileName = match[1].trim();

        return MediaWiki.getImagePath(fileName);
    }

    protected async getDescription(): Promise<string> {
        await this.initialized[PageLoadingState.PAGE_CONTENT];

        if (!this.page || !this.page.content) {
            throw new Error('Could not find page content');
        }

        const descPattern =
            /==\s*About\s(?:the\s)?[\w-]+?\s*==\n+([\s\S]+?)\n+=/;
        const match = this.page.content.match(descPattern);

        if (!match || !match[1]) {
            return super.getDescription();
        }

        return MediaWiki.stripMarkup(match[1]).trim().split('\n')[0];
    }

    async getInfo(): Promise<RaceInfo> {
        await this.initialized[RaceLoadState.CHOICES];

        return {
            name: this.name,
            description: await this.getDescription(),
            choices: this?.choices?.length ? this.choices : undefined,
            choiceType: this?.choices?.length
                ? CharacterPlannerStep.CHOOSE_SUBRACE
                : undefined,
            image: (await this.getImage()) ?? undefined,
        };
    }
}

let characterRaceData: CharacterRace[];

export async function getCharacterRaceData(): Promise<CharacterRace[]> {
    if (!characterRaceData) {
        const raceNames =
            await MwnApi.queryTitlesFromCategory('Playable races');

        characterRaceData = raceNames.map(
            (name) => new CharacterRace({ name, pageTitle: name }),
        );

        await Promise.all(
            characterRaceData.map((cr) => cr.waitForInitialization()),
        );
    }

    return characterRaceData;
}
