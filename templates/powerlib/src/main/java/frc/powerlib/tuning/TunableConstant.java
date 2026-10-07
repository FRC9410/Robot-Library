package frc.powerlib.tuning;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Marks a mutable numeric constants field for PowerLib live tuning. */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface TunableConstant {}
