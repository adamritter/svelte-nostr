export function mapBy<Item,Key>(arr: Array<Item>, by: (value: Item)=>Key): Map<Key,Item> {
    return arr.reduce((acc: any, item: any) => {
        acc[by(item)] = item;
        return acc;
    }, new Map());
}
        

export function groupBy<Item,Key>(arr: Array<Item>, by: (value: Item)=>Key): Map<Key,Item[]> {
    return arr.reduce((acc: Map<Key,Item[]>, item: Item) => {
        const key = by(item);
        if (!acc.get(key)) {
            acc.set(key, [])
        }
        // @ts-ignore
        acc.get(key).push(item);
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

export function mapValues<K, V, T>(obj: Map<K, V>, func: (value: V)=>T): Map<K,T> {
    return new Map(Array.from(obj.entries()).map(([key, value]) => [key, func(value)]));
}
