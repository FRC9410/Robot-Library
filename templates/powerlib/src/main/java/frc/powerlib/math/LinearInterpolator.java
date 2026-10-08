package frc.powerlib.math;

import java.util.Arrays;

/** Interpolates a copied table of finite x/y pairs, clamping outside its endpoints. */
public class LinearInterpolator {
    private final double[][] table;

    public LinearInterpolator(double[][] data) {
        if (data == null || data.length == 0) {
            throw new IllegalArgumentException("Interpolation needs at least one data point.");
        }
        table = new double[data.length][];
        for (int row = 0; row < data.length; row++) {
            if (data[row] == null || data[row].length != 2
                    || !Double.isFinite(data[row][0]) || !Double.isFinite(data[row][1])) {
                throw new IllegalArgumentException("Interpolation row " + row + " needs two finite numbers.");
            }
            table[row] = data[row].clone();
        }
        Arrays.sort(table, (left, right) -> Double.compare(left[0], right[0]));
        for (int row = 1; row < table.length; row++) {
            if (table[row - 1][0] == table[row][0]) {
                throw new IllegalArgumentException("Duplicate interpolation x: " + table[row][0]);
            }
        }
    }

    /** Retained for compatibility; construction now rejects invalid tables. */
    public boolean isInitialized() {
        return true;
    }

    public double getInterpolatedValue(double x) {
        if (!Double.isFinite(x)) {
            throw new IllegalArgumentException("Interpolation input must be finite.");
        }
        int index = 0;
        while (index < table.length && table[index][0] < x) {
            index++;
        }
        if (index == table.length) {
            return table[table.length - 1][1];
        }
        double highX = table[index][0];
        double highY = table[index][1];
        if (index == 0 || highX == x) {
            return highY;
        }
        double lowX = table[index - 1][0];
        double lowY = table[index - 1][1];
        return lowY + (x - lowX) * (highY - lowY) / (highX - lowX);
    }
}
