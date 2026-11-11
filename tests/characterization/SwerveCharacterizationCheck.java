package frc.powerlib.characterization;

import static org.junit.Assert.*;
import com.ctre.phoenix6.configs.*;
import com.ctre.phoenix6.hardware.*;
import com.ctre.phoenix6.swerve.*;
import com.ctre.phoenix6.swerve.SwerveModuleConstants.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.simulation.DriverStationSim;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import java.nio.file.*;
import java.util.*;

/** Real CTRE simulation requests and signals, isolated from any robot connection. */
public final class SwerveCharacterizationCheck {
  public static void main(String[] args) throws Exception {
    assertTrue(HAL.initialize(500,0));
    DriverStationSim.setDsAttached(true);DriverStationSim.setTest(true);DriverStationSim.setEnabled(false);
    var factory=new SwerveModuleConstantsFactory<TalonFXConfiguration,TalonFXConfiguration,CANcoderConfiguration>()
        .withDriveMotorGearRatio(6).withSteerMotorGearRatio(12).withCouplingGearRatio(0)
        .withWheelRadius(.05).withSpeedAt12Volts(4).withSlipCurrent(60)
        .withDriveMotorGains(new Slot0Configs()).withSteerMotorGains(new Slot0Configs().withKP(20))
        .withDriveMotorType(DriveMotorArrangement.TalonFX_Integrated)
        .withSteerMotorType(SteerMotorArrangement.TalonFX_Integrated)
        .withFeedbackSource(SteerFeedbackType.RemoteCANcoder)
        .withDriveMotorInitialConfigs(new TalonFXConfiguration()).withSteerMotorInitialConfigs(new TalonFXConfiguration())
        .withEncoderInitialConfigs(new CANcoderConfiguration()).withDriveInertia(.01).withSteerInertia(.01)
        .withDriveFrictionVoltage(.2).withSteerFrictionVoltage(.2);
    var modules=new SwerveModuleConstants<?,?,?>[4];
    for(int i=0;i<4;i++)modules[i]=factory.createModuleConstants(1+i*3,2+i*3,3+i*3,0,i<2?.3:-.3,i%2==0?.3:-.3,false,false,false);
    var drivetrain=new SwerveDrivetrain<TalonFX,TalonFX,CANcoder>(TalonFX::new,TalonFX::new,CANcoder::new,new SwerveDrivetrainConstants().withPigeon2Id(30),modules);
    var manager=new CharacterizationManager();manager.registerSwerve("drivetrain","Drivetrain",drivetrain,new SubsystemBase(){});
    var table=NetworkTableInstance.getDefault().getTable("PowerLib/Characterization");var json=new ObjectMapper();
    List<Object> tests=new ArrayList<>();long sequence=0;
    for(String kind:List.of("drive","steer"))for(String phase:List.of("quasistatic-forward","quasistatic-reverse","dynamic-forward","dynamic-reverse")){
      String id=UUID.randomUUID().toString();
      boolean manual=kind.equals("drive");
      table.getEntry("request").setString(json.writeValueAsString(Map.of("id",id,"target","drivetrain-"+kind,"phase",phase,"duration",.7,"ramp",1,"step",4,"manualControl",manual)));
      for(int i=0;i<5;i++){table.getEntry("heartbeat").setDouble(++sequence);tick(drivetrain);}
      assertEquals("prepared",json.readTree(table.getEntry("status").getString("{}")).path("state").asText());
      table.getEntry("simulationControl").setString(id+"|enable|go");
      if(manual){
        for(int i=0;i<5;i++){table.getEntry("heartbeat").setDouble(++sequence);tick(drivetrain);}
        assertFalse("NetworkTables must not enable a manual drive test",DriverStation.isEnabled());
        DriverStationSim.setEnabled(true);
      }
      double maximumVoltage=0,maximumVelocity=0;
      for(int i=0;i<100;i++){
        table.getEntry("heartbeat").setDouble(++sequence);tick(drivetrain);
        for(var module:drivetrain.getModules()){
          var motor=kind.equals("drive")?module.getDriveMotor():module.getSteerMotor();
          double voltage=Math.abs(motor.getMotorVoltage().getValueAsDouble());
          maximumVoltage=Math.max(maximumVoltage,voltage);
          maximumVelocity=Math.max(maximumVelocity,Math.abs(motor.getVelocity().getValueAsDouble()));
          if(!manual&&voltage>.05)assertEquals("Steering must not power the drive motor",0,module.getDriveMotor().getMotorVoltage().getValueAsDouble(),.02);
        }
        var status=json.readTree(table.getEntry("status").getString("{}"));
        if(status.path("state").asText().equals("complete")){
          tests.add(Map.of("id",id,"targetId","drivetrain-"+kind,"phase",phase,"file",status.path("file").asText()));break;
        }
      }
      assertTrue(kind+" "+phase+" voltage",maximumVoltage>.2);
      assertTrue(kind+" "+phase+" velocity",maximumVelocity>.001);
      assertEquals("complete",json.readTree(table.getEntry("status").getString("{}")).path("state").asText());
      table.getEntry("simulationControl").setString(id+"|disable|end");
      if(manual){
        for(int i=0;i<5;i++){table.getEntry("heartbeat").setDouble(++sequence);tick(drivetrain);}
        assertTrue("The operator must disable between drive steps",DriverStation.isEnabled());
        DriverStationSim.setEnabled(false);
      }
      for(int i=0;i<15;i++){table.getEntry("heartbeat").setDouble(++sequence);tick(drivetrain);}
      assertFalse(DriverStation.isEnabled());assertFalse(CharacterizationManager.isActive());
      for(var module:drivetrain.getModules()){
        assertEquals(0,module.getDriveMotor().getMotorVoltage().getValueAsDouble(),.02);
        assertEquals(0,module.getSteerMotor().getMotorVoltage().getValueAsDouble(),.02);
      }
    }
    String cancelled=UUID.randomUUID().toString();
    table.getEntry("request").setString(json.writeValueAsString(Map.of("id",cancelled,"target","drivetrain-drive",
        "phase","dynamic-forward","duration",3,"ramp",1,"step",4,"manualControl",true)));
    for(int i=0;i<5;i++){table.getEntry("heartbeat").setDouble(++sequence);tick(drivetrain);}
    DriverStationSim.setEnabled(true);
    for(int i=0;i<8;i++){table.getEntry("heartbeat").setDouble(++sequence);tick(drivetrain);}
    table.getEntry("request").setString(json.writeValueAsString(Map.of("id",cancelled,"cancel",true)));
    for(int i=0;i<8;i++){table.getEntry("heartbeat").setDouble(++sequence);tick(drivetrain);}
    assertEquals("cancelled",json.readTree(table.getEntry("status").getString("{}")).path("state").asText());
    assertTrue("Cancel must leave enable state under operator control",DriverStation.isEnabled());
    for(var module:drivetrain.getModules())assertEquals(0,module.getDriveMotor().getMotorVoltage().getValueAsDouble(),.02);
    DriverStationSim.setEnabled(false);
    for(int i=0;i<8;i++){table.getEntry("heartbeat").setDouble(++sequence);tick(drivetrain);}
    assertFalse(CharacterizationManager.isActive());
    Files.writeString(Path.of("swerve-run-data.json"),json.writeValueAsString(tests));
    drivetrain.close();System.out.println("CTRE drivetrain characterization passed: four manual drive profiles, four automatic steering profiles, neutral cancellation and four-module WPILOGs.");System.exit(0);
  }
  private static boolean wasEnabled;
  private static void tick(SwerveDrivetrain<?,?,?> drivetrain) throws Exception {
    DriverStationSim.notifyNewData();DriverStation.refreshData();
    if(DriverStation.isEnabled()&&!wasEnabled)CommandScheduler.getInstance().cancelAll();wasEnabled=DriverStation.isEnabled();
    com.ctre.phoenix6.unmanaged.Unmanaged.feedEnable(100);
    drivetrain.updateSimState(.02,12);CommandScheduler.getInstance().run();Thread.sleep(20);
  }
}
