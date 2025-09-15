declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function expect(actual: any): {
    toContain(expected: string): void;
    toBe(expected: any): void;
    toEqual(expected: any): void;
    toThrow(): void;
    not: {
      toContain(expected: string): void;
      toBe(expected: any): void;
    };
  };
}
