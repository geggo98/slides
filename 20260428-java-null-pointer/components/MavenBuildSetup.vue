<script setup lang="ts">
import MonacoBlock from "@shared/components/MonacoBlock.vue";

const code = `<dependencies>
  <dependency>
    <groupId>org.jspecify</groupId>
    <artifactId>jspecify</artifactId>
    <!-- Version vom Spring-Boot-4-Parent-POM verwaltet -->
  </dependency>
</dependencies>

<build><plugins>
  <plugin>
    <artifactId>maven-compiler-plugin</artifactId>
    <configuration>
      <compilerArgs>
        <arg>-XDcompilePolicy=simple</arg>
        <arg>-Xplugin:ErrorProne</arg>
        <arg>-Xep:NullAway:ERROR</arg>
        <arg>-XepOpt:NullAway:OnlyNullMarked=true</arg>
        <arg>-XepOpt:NullAway:JSpecifyMode=true</arg>
      </compilerArgs>
      <annotationProcessorPaths>
        <path>
          <groupId>com.google.errorprone</groupId>
          <artifactId>error_prone_core</artifactId>
          <version>2.42.0</version>
        </path>
        <path>
          <groupId>com.uber.nullaway</groupId>
          <artifactId>nullaway</artifactId>
          <version>0.13.2</version>
        </path>
      </annotationProcessorPaths>
    </configuration>
  </plugin>
</plugins></build>`;
</script>

<template>
  <MonacoBlock :code="code" language="xml" height="300px" />
</template>
