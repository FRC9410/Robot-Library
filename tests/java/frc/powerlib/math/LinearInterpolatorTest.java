package frc.powerlib.math;

import static org.junit.Assert.*;
import org.junit.Test;

public class LinearInterpolatorTest {
    @Test public void sortsInterpolatesAndClamps() {
        var interpolation = new LinearInterpolator(new double[][] {{3, 31}, {10, 100}, {1, 10}});
        assertEquals(10, interpolation.getInterpolatedValue(-10), 0);
        assertEquals(31, interpolation.getInterpolatedValue(3), 0);
        assertEquals(15.25, interpolation.getInterpolatedValue(1.5), 0);
        assertEquals(100, interpolation.getInterpolatedValue(20), 0);
    }

    @Test public void copiesSinglePoint() {
        double[][] points = {{1, 10}};
        var interpolation = new LinearInterpolator(points);
        points[0][1] = 99;
        assertTrue(interpolation.isInitialized());
        assertEquals(10, interpolation.getInterpolatedValue(-1), 0);
        assertEquals(10, interpolation.getInterpolatedValue(2), 0);
    }

    @Test public void rejectsMalformedRows() {
        double[][][] invalid = {null, {}, {null}, {{1}}, {{1, 2, 3}}, {{1, 2}, {3}},
                {{Double.NaN, 1}}, {{1, Double.POSITIVE_INFINITY}}};
        for (double[][] points : invalid) {
            assertThrows(IllegalArgumentException.class, () -> new LinearInterpolator(points));
        }
    }

    @Test public void rejectsDuplicateInputsIncludingSignedZero() {
        assertThrows(IllegalArgumentException.class,
                () -> new LinearInterpolator(new double[][] {{1, 10}, {1, 20}}));
        assertThrows(IllegalArgumentException.class,
                () -> new LinearInterpolator(new double[][] {{-0.0, 10}, {0.0, 20}}));
    }

    @Test public void rejectsNonfiniteQueries() {
        var interpolation = new LinearInterpolator(new double[][] {{1, 10}, {2, 20}});
        for (double query : new double[] {Double.NaN, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY}) {
            assertThrows(IllegalArgumentException.class, () -> interpolation.getInterpolatedValue(query));
        }
    }
}
