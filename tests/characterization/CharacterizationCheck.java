package frc.powerlib.characterization;

import static org.junit.Assert.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.simulation.DriverStationSim;
import edu.wpi.first.wpilibj.simulation.SimHooks;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import frc.powerlib.configs.*;
import frc.powerlib.subsystems.VelocitySubsystem;
import frc.powerlib.subsystems.io.VelocitySubsystemIO;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

public final class CharacterizationCheck {
  static final ObjectMapper JSON=new ObjectMapper();
  static int checks;
  static boolean wasTestEnabled;
  static boolean externalDs;
  static double u,v,p;
  static final double KS=.3,KV=.12,KA=.04;
  static final List<Object> records=new ArrayList<>();
  static final varTable table = new varTable();
  static class varTable {
    final edu.wpi.first.networktables.NetworkTable value=NetworkTableInstance.getDefault().getTable("PowerLib/Characterization");
  }
  static void tick(boolean heartbeat) throws Exception {
    if(heartbeat)table.value.getEntry("heartbeat").setDouble(++checks);
    DriverStationSim.notifyNewData();DriverStation.refreshData();
    boolean testEnabled=DriverStation.isTestEnabled();
    if(testEnabled&&!wasTestEnabled)CommandScheduler.getInstance().cancelAll(); // Stock Robot.testInit().
    wasTestEnabled=testEnabled;
    SimHooks.stepTiming(.02);CommandScheduler.getInstance().run();
  }
  static com.fasterxml.jackson.databind.JsonNode status() throws Exception {return JSON.readTree(table.value.getEntry("status").getString("{}"));}
  static void prepare(String id,String phase) throws Exception {
    table.value.getEntry("request").setString(JSON.writeValueAsString(Map.of("id",id,"target","velocity","phase",phase,"duration",1.5,"ramp",1,"step",4)));
    for(int i=0;i<7;i++)tick(true);
    assertEquals("prepared",status().path("state").asText());
  }
  public static void main(String[] args) throws Exception {
    externalDs=args.length>0&&args[0].equals("external-ds");
    assertTrue(CharacterizationManager.usesSimulationControl(true,null));
    assertFalse(CharacterizationManager.usesSimulationControl(false,null));
    assertFalse(CharacterizationManager.usesSimulationControl(true,"C:/HALSIM_GUI.dll;C:/HALSIM_DS_SOCKET.dll"));
    assertTrue(HAL.initialize(500,0));SimHooks.pauseTiming();DriverStationSim.setDsAttached(true);DriverStationSim.setTest(true);DriverStationSim.setEnabled(false);
    var config=new VelocitySubsystemConfig(List.of(MotorConfig.leader(20,com.ctre.phoenix6.signals.NeutralModeValue.Brake,false)),
        new LeadMotorConfig(0,0,0,0,Optional.empty(),Optional.empty(),Optional.empty(),1,1),new MotionMagicConfig(0,0),"Velocity");
    var io=new VelocitySubsystemIO(){
      @Override public void setVoltage(double value){u=value;}
      @Override public void setVelocity(double value){u=0;}
      @Override public void updateInputs(Inputs inputs){
        double a=(u-KV*v-(Math.abs(v)>1e-6?Math.copySign(KS,v):Math.abs(u)>KS?Math.copySign(KS,u):u))/KA;
        v+=a*.02;p+=v*.02;inputs.positionRotations=p;inputs.velocityRotationsPerSecond=v;inputs.appliedVoltage=u;inputs.torqueCurrentAmps=.5*Math.signum(v)+.1*v+.02*a;
      }
    };
    var velocity=new VelocitySubsystem(config,io);var manager=new CharacterizationManager(!externalDs);manager.registerVelocity("velocity","Velocity",velocity);
    for(int i=0;i<5;i++)tick(true);
    assertEquals(externalDs?"driver-station":"simulation",status().path("controlMode").asText());
    for(String phase:List.of("quasistatic-forward","quasistatic-reverse","dynamic-forward","dynamic-reverse")){
      String id=UUID.randomUUID().toString();prepare(id,phase);
      assertTrue(CharacterizationManager.isActive());assertEquals(0,u,0);
      table.value.getEntry("simulationControl").setString(id+"|enable|"+UUID.randomUUID());
      if(externalDs){
        for(int i=0;i<7;i++)tick(true);
        assertFalse("External DS mode ignores internal enable requests",DriverStation.isEnabled());
        assertEquals("prepared",status().path("state").asText());
        DriverStationSim.setEnabled(true); // Incoming external DS state; no real DS keys.
      }
      for(int i=0;i<150&&!status().path("state").asText().equals("complete");i++)tick(true);
      assertEquals("complete",status().path("state").asText());assertEquals(0,u,0);
      assertTrue(CharacterizationManager.isActive());
      records.add(Map.of("id",id,"phase",phase,"file",status().path("file").asText()));
      assertTrue(Files.size(Path.of(status().path("file").asText()))>100);
      table.value.getEntry("simulationControl").setString(id+"|disable|"+UUID.randomUUID());
      if(externalDs){
        for(int i=0;i<7;i++)tick(true);
        assertTrue("Internal disable must not override external DS",DriverStation.isEnabled());
        DriverStationSim.setEnabled(false);
      }
      for(int i=0;i<35;i++)tick(true);
      assertFalse(DriverStation.isEnabled());assertFalse(CharacterizationManager.isActive());
    }
    prepare(UUID.randomUUID().toString(),"dynamic-forward");
    table.value.getEntry("simulationControl").setString(status().path("id").asText()+"|enable|manual");
    if(externalDs)DriverStationSim.setEnabled(true);
    for(int i=0;i<10;i++)tick(true);assertEquals("running",status().path("state").asText());
    DriverStationSim.setEnabled(false);for(int i=0;i<8;i++)tick(true);
    assertEquals("cancelled",status().path("state").asText());assertEquals(0,u,0);
    prepare(UUID.randomUUID().toString(),"dynamic-forward");
    table.value.getEntry("simulationControl").setString(status().path("id").asText()+"|enable|lease");
    if(externalDs)DriverStationSim.setEnabled(true);
    for(int i=0;i<10;i++)tick(true);
    for(int i=0;i<90;i++)tick(false);
    assertEquals("cancelled",status().path("state").asText());assertEquals(externalDs,DriverStation.isEnabled());assertEquals(0,u,0);
    if(externalDs){
      assertTrue("Neutral output held until external DS disables",CharacterizationManager.isActive());
      DriverStationSim.setEnabled(false);for(int i=0;i<8;i++)tick(true);
      assertFalse(CharacterizationManager.isActive());
    }
    DriverStationSim.setFmsAttached(true);prepareRejected();DriverStationSim.setFmsAttached(false);
    Files.writeString(Path.of(externalDs?"external-ds-run-data.json":"run-data.json"),JSON.writeValueAsString(Map.of("tests",records,"truth",Map.of("kS",KS,"kV",KV,"kA",KA))));
    System.out.println("Characterization runtime passed ("+(externalDs?"external DS":"internal simulation")+"): four real SysId waveforms, disabled gaps, closed WPILOGs, manual disable, lease loss, FMS rejection and zero output cleanup.");
    CommandScheduler.getInstance().cancelAll();System.exit(0);
  }
  static void prepareRejected() throws Exception {
    table.value.getEntry("request").setString(JSON.writeValueAsString(Map.of("id",UUID.randomUUID().toString(),"target","velocity","phase","dynamic-forward","duration",1,"ramp",1,"step",4)));
    for(int i=0;i<6;i++)tick(true);assertEquals("failed",status().path("state").asText());assertEquals(0,u,0);
  }
}
