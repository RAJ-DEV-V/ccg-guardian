using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;

namespace EngineeringGuardian
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("================================================================");
            Console.WriteLine("   🛡️  ENGINEERING GUARDIAN (CCG) - DESKTOP DASHBOARD LAUNCHER");
            Console.WriteLine("   Local-First Real-Time Security, Quality & Architecture Engine");
            Console.WriteLine("================================================================");
            Console.ResetColor();

            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string serverScript = Path.Combine(appDir, "tools", "guardian", "dashboard-server.mjs");

            // If running directly inside tools/guardian
            if (!File.Exists(serverScript))
            {
                serverScript = Path.Combine(appDir, "dashboard-server.mjs");
            }
            if (!File.Exists(serverScript))
            {
                serverScript = Path.Combine(appDir, "..", "tools", "guardian", "dashboard-server.mjs");
            }

            if (!File.Exists(serverScript))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[-] Error: dashboard-server.mjs not found at: " + serverScript);
                Console.ResetColor();
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
                return;
            }

            string extraArgs = "";
            if (args.Length > 0)
            {
                extraArgs = " \"" + string.Join("\" \"", args) + "\"";
            }

            // Clean up any stale or zombie node process holding port 4321
            try
            {
                Process netstat = new Process();
                netstat.StartInfo = new ProcessStartInfo("cmd.exe", "/c netstat -ano | findstr :4321 | findstr LISTENING")
                {
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                netstat.Start();
                string output = netstat.StandardOutput.ReadToEnd();
                netstat.WaitForExit();
                if (!string.IsNullOrEmpty(output))
                {
                    string[] lines = output.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (string line in lines)
                    {
                        string[] parts = line.Trim().Split(new char[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length > 0)
                        {
                            int pid;
                            if (int.TryParse(parts[parts.Length - 1], out pid))
                            {
                                try { Process.GetProcessById(pid).Kill(); } catch { }
                            }
                        }
                    }
                }
            }
            catch { }

            Console.WriteLine("[+] Guardian Root Directory: " + Path.GetFullPath(Path.Combine(appDir, "..")));
            Console.WriteLine("[+] Launching Live Telemetry Engine on http://localhost:4321 ...");

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "node";
            psi.Arguments = "\"" + serverScript + "\"" + extraArgs;
            psi.UseShellExecute = false;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            psi.CreateNoWindow = true;

            Process serverProcess = null;
            try
            {
                serverProcess = Process.Start(psi);
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[-] Failed to start Node.js runtime: " + ex.Message);
                Console.WriteLine("Please ensure Node.js is installed on your system PATH.");
                Console.ResetColor();
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
                return;
            }

            // Forward stdout/stderr asynchronously
            serverProcess.OutputDataReceived += (s, e) => {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    Console.WriteLine("[Guardian] " + e.Data);
                }
            };
            serverProcess.ErrorDataReceived += (s, e) => {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    Console.WriteLine("[Guardian-Err] " + e.Data);
                }
            };
            serverProcess.BeginOutputReadLine();
            serverProcess.BeginErrorReadLine();

            // Wait 1.5 seconds for server to bind
            Thread.Sleep(1500);

            // Open browser
            string dashboardUrl = "http://localhost:4321";
            try
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("[+] Connected! Opening browser at: " + dashboardUrl);
                Console.ResetColor();
                Process.Start(new ProcessStartInfo(dashboardUrl) { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                Console.WriteLine("[!] Could not auto-launch browser: " + ex.Message);
                Console.WriteLine("[+] Open manually at: " + dashboardUrl);
            }

            Console.WriteLine("\n----------------------------------------------------------------");
            Console.WriteLine("  Live Guardian Dashboard is running.");
            Console.WriteLine("  Press Ctrl+C or close this window to stop the dashboard server.");
            Console.WriteLine("----------------------------------------------------------------\n");
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.WriteLine("credits to developer rajvansh mishra, backend developer, lovely professional university (https://github.com/RAJ-DEV-V)");
            Console.ResetColor();

            serverProcess.WaitForExit();
        }
    }
}
