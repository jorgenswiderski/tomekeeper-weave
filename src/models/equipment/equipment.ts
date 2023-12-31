import {
    EquipmentItemType,
    ItemRarity,
} from '@jorgenswiderski/tomekeeper-shared/dist/types/equipment-item';
import { MediaWiki } from '../media-wiki/media-wiki';
import { EquipmentItem } from './equipment-item';
import { WeaponItem } from './weapon-item';
import { StaticImageCacheService } from '../static-image-cache-service';
import { Utils } from '../utils';

let itemData: Record<string, EquipmentItem[]> | null = null;
let itemDataById: Map<number, EquipmentItem> | null = null;

export async function getEquipmentItemData(
    types?: EquipmentItemType[],
): Promise<Record<string, EquipmentItem[]>> {
    if (!itemData) {
        const equipmentItemNames = await MediaWiki.getTitlesInCategories([
            'Equipment',
            'Clothing',
            'Light Armour',
            'Medium Armour',
            'Heavy Armour',
            'Shields',
            'Helmets',
            'Cloaks',
            'Gloves',
            'Boots',
            'Amulets',
            'Rings',
        ]);

        const pages = await Promise.all(
            equipmentItemNames.map((name) => MediaWiki.getPage(name)),
        );

        const weaponNames = (
            await Utils.asyncFilter(pages, (page) =>
                page.hasTemplate('WeaponPage'),
            )
        ).map((page) => page.title);

        const armourNames = (
            await Utils.asyncFilter(pages, (page) =>
                page.hasTemplate('EquipmentPage'),
            )
        ).map((page) => page.title);

        const data = [
            ...armourNames.map((name) => new EquipmentItem(name)),
            ...weaponNames.map((name) => new WeaponItem(name)),
        ];

        await Promise.all(data.map((item) => item.waitForInitialization()));

        const filtered = data.filter(
            (item) =>
                item.obtainable &&
                ((item?.rarity && item?.rarity > ItemRarity.common) ||
                    item.baseArmorClass ||
                    item instanceof WeaponItem),
        );

        filtered.forEach(
            (item) =>
                item.image && StaticImageCacheService.cacheImage(item.image),
        );

        itemData = filtered.reduce(
            (acc, item) => {
                if (item.type) {
                    if (!acc[item.type]) {
                        acc[item.type] = [];
                    }

                    acc[item.type].push(item);
                }

                return acc;
            },
            {} as Record<string, EquipmentItem[]>,
        );

        itemDataById = new Map<number, EquipmentItem>();
        filtered.forEach((item) => itemDataById!.set(item.id!, item));
    }

    if (!types) {
        return itemData;
    }

    const filteredData: Record<string, EquipmentItem[]> = {};

    types.forEach((type) => {
        if (itemData![type]) {
            filteredData[type] = itemData![type];
        }
    });

    return filteredData;
}

export async function getEquipmentItemInfoById() {
    if (!itemDataById) {
        await getEquipmentItemData();
    }

    return itemDataById!;
}
