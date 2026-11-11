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
import frc.powerlib.subsystems.AbsolutePositionSubsystem;
import frc.powerlib.subsystems.VelocitySubsystem;
import frc.powerlib.subsystems.io.AbsolutePositionSubsystemIO;
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
    table.value.getEntry("request").setString(JSON.writeValueAsString(Map.of("id",id,"target","velocity","phase",phase,"duration",5,"ramp",1,"step",4,"rampLimit",3)));
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
    var referenceLog=new ArrayList<String>();
    var velocity=new VelocitySubsystem(config,io);
    var manager=new CharacterizationManager(!externalDs,(name,value)->referenceLog.add(name+"="+value));
    manager.registerVelocity("velocity","Velocity",velocity);
    for(int i=0;i<5;i++)tick(true);
    assertEquals(externalDs?"driver-station":"simulation",status().path("controlMode").asText());
    assertTrue(status().path("separateRampLimit").asBoolean());
    for(String phase:List.of("quasistatic-forward","quasistatic-reverse","dynamic-forward","dynamic-reverse")){
      String id=UUID.randomUUID().toString();prepare(id,phase);
      referenceLog.clear();
      assertTrue(CharacterizationManager.isActive());assertEquals(0,u,0);
      table.value.getEntry("simulationControl").setString(id+"|enable|"+UUID.randomUUID());
      if(externalDs){
        for(int i=0;i<7;i++)tick(true);
        assertFalse("External DS mode ignores internal enable requests",DriverStation.isEnabled());
        assertEquals("prepared",status().path("state").asText());
        DriverStationSim.setEnabled(true); // Incoming external DS state; no real DS keys.
      }
      double peak=0;
      int ticks=0;
      for(;ticks<300&&!status().path("state").asText().equals("complete");ticks++) {
        tick(true);
        peak=Math.max(peak,Math.abs(u));
        if(u!=0)assertEquals(phase.endsWith("reverse")?-1:1,Math.signum(u),0);
      }
      assertEquals("complete",status().path("state").asText());assertEquals(0,u,0);
      assertTrue("Expected a five-second run, ticks="+ticks,ticks>=249&&ticks<=265);
      assertEquals(phase.startsWith("quasistatic")?3:4,peak,1e-8);
      assertEquals("PowerToolCharacterization/TestId="+id,referenceLog.get(0));
      assertEquals("PowerToolCharacterization/Target=velocity",referenceLog.get(1));
      assertTrue(referenceLog.contains("PowerToolCharacterization/State="+phase));
      assertEquals("PowerToolCharacterization/State=none",referenceLog.get(referenceLog.size()-1));
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
    checkCrawl(manager);
    Files.writeString(Path.of(externalDs?"external-ds-run-data.json":"run-data.json"),JSON.writeValueAsString(Map.of("tests",records,"truth",Map.of("kS",KS,"kV",KV,"kA",KA))));
    System.out.println("Characterization runtime passed ("+(externalDs?"external DS":"internal simulation")+"): four five-second waveforms, independent ramp and step limits, CTRE reference markers, closed WPILOGs, manual disable, lease loss, FMS rejection and zero output cleanup.");
    CommandScheduler.getInstance().cancelAll();System.exit(0);
  }
  static void checkCrawl(CharacterizationManager manager) throws Exception {
    var motor = MotorConfig.leader(21, com.ctre.phoenix6.signals.NeutralModeValue.Brake, false);
    var config = new AbsolutePositionSubsystemConfig(List.of(motor),
        new LeadMotorConfig(0, 0, 0, 0, Optional.empty(), Optional.empty(), Optional.empty(), 1, 1),
        new CancoderConfig(22, 0, .5), new MotionMagicConfig(0, 0), "Arm", "rotations", Optional.of(0.0));
    double[] feedback = {0, 0};
    double[] output = {0};
    var io = new AbsolutePositionSubsystemIO() {
      @Override public void updateInputs(Inputs inputs) {
        inputs.positionRotations = feedback[0];
        inputs.velocityRotationsPerSecond = feedback[1];
        inputs.appliedVoltage = output[0];
      }
      @Override public void setVoltage(double volts) { output[0] = volts; }
      @Override public void stop() { output[0] = 0; }
    };
    var arm = new AbsolutePositionSubsystem(config, io);
    manager.registerPositionCrawl("arm", "Arm", arm);
    String id = UUID.randomUUID().toString();
    publish("request", Map.of("id", id, "target", "arm", "phase", "crawl", "lower", -.2, "upper", .2, "margin", .05));
    tick(true);
    assertEquals("prepared", status().path("state").asText());
    table.value.getEntry("simulationControl").setString(id + "|enable|crawl");
    publish("crawlNudge", Map.of("id", id, "direction", 1, "level", 1));
    for (int i = 0; i < 3; i++) tick(true);
    assertFalse(DriverStation.isEnabled());
    assertEquals(0, output[0], 0);
    DriverStationSim.setEnabled(true);
    for (int i = 0; i < 3; i++) tick(true);
    assertEquals("ready", status().path("state").asText());
    assertEquals(0, output[0], 0);
    crawlNudge(id, 1, .010);
    assertEquals(.09, output[0], 1e-9);
    feedback[1] = .011;
    tick(true);
    assertEquals(0, output[0], 0);
    assertEquals("ready", status().path("state").asText());
    feedback[1] = 0;
    crawlNudge(id, -1, .125);
    assertEquals(-.45, output[0], 1e-9);
    for (int i = 0; i < 9; i++) tick(true);
    assertEquals(0, output[0], 0);
    feedback[0] = .14;
    crawlNudge(id, 1, .010);
    assertEquals(.09, output[0], 1e-9);
    feedback[0] = .16;
    tick(true);
    assertEquals(0, output[0], 0);
    assertTrue(status().path("error").asText().contains("stopping margin"));
    crawlNudge(id, -1, .015);
    assertEquals(0, output[0], 0);
    feedback[0] = 0;
    crawlNudge(id, 1, .005);
    assertEquals(.07, output[0], 1e-9);
    DriverStationSim.setEnabled(false);
    tick(true);
    assertEquals(0, output[0], 0);
    assertEquals("cancelled", status().path("state").asText());
    for (int i = 0; i < 7; i++) tick(true);
    assertFalse(CharacterizationManager.isActive());

    String lost = UUID.randomUUID().toString();
    publish("request", Map.of("id", lost, "target", "arm", "phase", "crawl", "lower", -.2, "upper", .2, "margin", .05));
    tick(true);
    DriverStationSim.setEnabled(true);
    tick(true);
    crawlNudge(lost, 1, .010);
    assertEquals(.09, output[0], 1e-9);
    // Hold the output active only in the fixture and advance both the robot and NT clocks.
    Thread.sleep(550);
    for (int i = 0; i < 26; i++) tick(true);
    assertEquals(0, output[0], 0);
    assertEquals("cancelled", status().path("state").asText());
    assertTrue("Crawl leaves disable with the operator", DriverStation.isEnabled());
    DriverStationSim.setEnabled(false);
    for (int i = 0; i < 8; i++) tick(true);
    assertFalse(CharacterizationManager.isActive());
    checkPositionSysId(feedback, output);
    System.out.println("Position crawl passed: manual enable, low voltage, flipped nudge, travel/speed/time cutoffs, disable and lease loss.");
  }

  static void checkPositionSysId(double[] feedback, double[] output) throws Exception {
    var window = Map.of("lower", -.2, "upper", .2, "margin", .05, "speedLimit", .10, "polarity", -1);
    var request = new LinkedHashMap<String, Object>(Map.of("target", "arm", "phase", "dynamic-forward",
        "positionTest", window, "duration", 3, "step", .3, "ramp", .1));
    request.put("id", UUID.randomUUID().toString());
    publish("request", request);
    tick(true);
    assertEquals("failed", status().path("state").asText());
    assertEquals(0, output[0], 0);

    for (String cutoff : List.of("speed cutoff", "stopping margin")) {
      String id = UUID.randomUUID().toString();
      request.put("id", id);
      request.put("manualControl", true);
      feedback[0] = 0;
      feedback[1] = 0;
      tick(true);
      publish("request", request);
      tick(true);
      assertEquals(status().toString(), "prepared", status().path("state").asText());
      table.value.getEntry("simulationControl").setString(id + "|enable|position-sysid");
      tick(true);
      assertFalse(DriverStation.isEnabled());
      assertEquals(0, output[0], 0);
      DriverStationSim.setEnabled(true);
      for (int i=0; i<20; i++) tick(true);
      assertEquals("running", status().path("state").asText());
      assertEquals(-.3, output[0], 1e-9);
      if (cutoff.equals("speed cutoff")) feedback[1] = .11; else feedback[0] = .16;
      tick(true);
      assertEquals("complete", status().path("state").asText());
      assertTrue(status().path("error").asText().contains(cutoff));
      assertEquals(0, output[0], 0);
      assertTrue(Files.size(Path.of(status().path("file").asText())) > 100);
      assertTrue(DriverStation.isEnabled());
      DriverStationSim.setEnabled(false);
      for (int i=0; i<7; i++) tick(true);
      assertFalse(CharacterizationManager.isActive());
    }
    System.out.println("Position SysId passed: manual arm, polarity, robot cutoffs, WPILOG and disabled release.");
  }

  static void crawlNudge(String id, int direction, double speedLimit) throws Exception {
    table.value.getEntry("crawlLease").setString(id + "|" + UUID.randomUUID());
    publish("crawlNudge", Map.of("id", id, "token", UUID.randomUUID().toString(), "direction", direction, "speedLimit", speedLimit));
    tick(true);
  }

  static void publish(String entry, Map<String, ?> value) throws Exception {
    table.value.getEntry(entry).setString(JSON.writeValueAsString(value));
  }

  static void prepareRejected() throws Exception {
    table.value.getEntry("request").setString(JSON.writeValueAsString(Map.of("id",UUID.randomUUID().toString(),"target","velocity","phase","dynamic-forward","duration",1,"ramp",1,"step",4)));
    for(int i=0;i<6;i++)tick(true);assertEquals("failed",status().path("state").asText());assertEquals(0,u,0);
  }
}
