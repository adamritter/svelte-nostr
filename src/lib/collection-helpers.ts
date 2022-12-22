export function mapBy<Item,Key>(arr: Array<Item>, by: (value: Item)=>Key): Map<Key,Item> {
    return arr.reduce((acc: any, item: any) => {
        acc[by(item)] = item;
        return acc;
    }, new Map());
}
        

export function groupBy<Item,Key>(arr: Array<Item>, by: (value: Item)=>Key): Map<Key,Item[]> {
    return arr.reduce((acc: any, item: any) => {
        const key = by(item);
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(item);
        return acc;
    }, new Map());
}

export function unique(arr: Array<any>): Array<any> {
    return [...new Set(arr)];
}