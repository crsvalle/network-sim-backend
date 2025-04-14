const { dijkstra } = require('./dijkstras');

describe('Dijkstra Algorithm', () => {
    const graph = {
        A: { B: 1, C: 4 },
        B: { C: 2, D: 5 },
        C: { D: 1 },
        D: {}
    };

    test('returns correct shortest distances', () => {
        const { distances } = dijkstra(graph, 'A');
        expect(distances).toEqual({
            A: 0,
            B: 1,
            C: 3,
            D: 4
        });
    });

    test('returns correct previous path', () => {
        const { previous } = dijkstra(graph, 'A');
        expect(previous).toEqual({
            A: null,
            B: 'A',
            C: 'B',
            D: 'C'
        });
    });

    test('returns Infinity for unreachable nodes', () => {
        const graph = {
            A: { B: 2 },
            B: {},
            C: { D: 1 },
            D: {}
        };
        const { distances } = dijkstra(graph, 'A');
        expect(distances.C).toBe(Infinity);
        expect(distances.D).toBe(Infinity);
    });

    test('handles zero-weight edges', () => {
        const graph = {
            A: { B: 0 },
            B: { C: 1 },
            C: {}
        };
        const { distances } = dijkstra(graph, 'A');
        expect(distances.C).toBe(1);
    });

    test('handles cycles without infinite loop', () => {
        const graph = {
            A: { B: 1 },
            B: { C: 1 },
            C: { A: 1 }  // cycle back to A
        };
        const { distances } = dijkstra(graph, 'A');
        expect(distances.C).toBe(2);
    });
    
    test('returns Infinity when start node is missing', () => {
        const graph = { A: { B: 1 }, B: {} };
        const { distances } = dijkstra(graph, 'Z');
        expect(distances.A).toBe(Infinity);
        expect(distances.B).toBe(Infinity);
    });

});


