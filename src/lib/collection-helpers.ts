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

export function sortBy(arr: Array<any>, by: (value: any)=>any): Array<any> {
    return arr.sort((a, b) => {
        const aBy = by(a);
        const bBy = by(b);
        if (aBy < bBy) {
            return -1;
        }
        if (aBy > bBy) {
            return 1;
        }
        return 0;
    });
}