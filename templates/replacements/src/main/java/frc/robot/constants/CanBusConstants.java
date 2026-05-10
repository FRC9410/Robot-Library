package frc.robot.constants;

import com.ctre.phoenix6.CANBus;

public class CanBusConstants {
  public static final String CANIVORE_BUS_NAME = "canivore";
  public static final String RIO_BUS_NAME = "rio";

  public static final CANBus CANIVORE_BUS = new CANBus(CANIVORE_BUS_NAME);
}
