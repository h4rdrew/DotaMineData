using ProcessaDados.App;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

try
{
    Log.Information("Aplicação iniciada: v{Version}", typeof(Program).Assembly.GetName().Version);
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
