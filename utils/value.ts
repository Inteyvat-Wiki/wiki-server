export function round(num: number, digits: number) {
    const factor = 10 ** digits
    return Math.round((num + Number.EPSILON) * factor) / factor
}
export function round_string(str: string, digit: number): string {
    return str.replace(/(-?\d+\.\d+)?/g, (match) => {
        const num = parseFloat(match)
        if (isNaN(num)) return match
        return round(num, digit).toString()
    })
}