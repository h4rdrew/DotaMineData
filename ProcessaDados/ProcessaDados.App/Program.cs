using ProcessaDados.App;
using Serilog;
using System.Diagnostics;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

try
{
    var version = FileVersionInfo
        .GetVersionInfo(typeof(Program).Assembly.Location)
        .FileVersion;

    Log.Information("Aplicação iniciada: v{Version}", version);
    await new DataProcessingApplication().RunAsync();
}
catch (Exception exception)
{
    Log.Fatal(exception, "A aplicação foi encerrada por um erro inesperado");
    Environment.ExitCode = 1;
}
finally
{
    await Log.CloseAndFlushAsync();
}
