using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Runtime.InteropServices;

namespace Web2Apk.Desktop
{
    public partial class MainForm : Form
    {
        private WebView2 webView;
        
        // 用于启用窗口边框拖拽调整大小
        private const int WM_NCHITTEST = 0x0084;
        private const int HTBOTTOMRIGHT = 17;
        private const int HTBOTTOM = 15;
        private const int HTRIGHT = 11;
        private const int HTLEFT = 10;
        private const int HTTOP = 12;
        private const int HTTOPLEFT = 13;
        private const int HTTOPRIGHT = 14;
        private const int HTBOTTOMLEFT = 16;
        private const int BORDER_WIDTH = 5;

        public MainForm()
        {
            InitializeComponent();
            StartServer();
            InitializeWebView();
        }

        private void InitializeComponent()
        {
            this.ClientSize = new System.Drawing.Size(1200, 800);
            this.Text = "网页转APK工具";
            this.WindowState = FormWindowState.Normal; // 改为Normal以允许窗口调整大小
            this.FormBorderStyle = FormBorderStyle.Sizable; // 可调整大小的边框
            this.StartPosition = FormStartPosition.CenterScreen;
            this.MinimumSize = new System.Drawing.Size(800, 600); // 设置最小窗口大小
            this.FormClosing += MainForm_FormClosing;
        }

        private async void InitializeWebView()
        {
            // 创建 WebView2 控件
            webView = new WebView2();
            webView.Dock = DockStyle.Fill;
            
            // 等待 WebView2 控件初始化
            await webView.EnsureCoreWebView2Async(null);
            
            // 设置 WebView2 的大小和位置
            webView.Size = new System.Drawing.Size(this.ClientSize.Width, this.ClientSize.Height);
            webView.Location = new System.Drawing.Point(0, 0);
            
            // 导航到本地服务器
            webView.CoreWebView2.Navigate("http://localhost:3000/desktop.html");
            
            // 添加 WebView2 到窗体
            this.Controls.Add(webView);
            
            // 监听 WebView 导航完成事件
            webView.CoreWebView2.NavigationCompleted += (sender, args) => {
                // 页面加载完成后的处理
            };
            
            // 监听 WebView 发送的消息
            webView.CoreWebView2.WebMessageReceived += WebMessageReceived;
        }

        private void WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string message = e.TryGetWebMessageAsString();
            if (message.Contains("minimize"))
            {
                this.WindowState = FormWindowState.Minimized;
            }
            else if (message.Contains("close"))
            {
                this.Close();
            }
            else if (message.Contains("maximize"))
            {
                this.WindowState = this.WindowState == FormWindowState.Maximized ? 
                    FormWindowState.Normal : FormWindowState.Maximized;
            }
        }

        private void StartServer()
        {
            try
            {
                // 启动 Node.js 服务器
                System.Diagnostics.ProcessStartInfo startInfo = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "node",
                    Arguments = "server.js",
                    WorkingDirectory = System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), ".."),
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };

                System.Diagnostics.Process serverProcess = new System.Diagnostics.Process
                {
                    StartInfo = startInfo
                };

                serverProcess.Start();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"无法启动服务器: {ex.Message}\n请确保已安装 Node.js 并且项目文件存在。", 
                               "服务器启动错误", 
                               MessageBoxButtons.OK, 
                               MessageBoxIcon.Error);
            }
        }

        private void ExitToolStripMenuItem_Click(object sender, EventArgs e)
        {
            this.Close();
        }

        private void SettingsToolStripMenuItem_Click(object sender, EventArgs e)
        {
            this.Invoke((MethodInvoker)delegate {
                if (webView != null && webView.CoreWebView2 != null)
                {
                    webView.CoreWebView2.PostWebMessageAsString("{\"action\": \"open-settings\"}");
                }
            });
        }

        private void AboutToolStripMenuItem_Click(object sender, EventArgs e)
        {
            MessageBox.Show("网页转APK工具桌面版\n基于 WebView2 技术构建\n版本 1.0.0", 
                           "关于", 
                           MessageBoxButtons.OK, 
                           MessageBoxIcon.Information);
        }

        private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            // 可以在这里添加清理代码
        }

        private System.ComponentModel.IContainer components = null;

        // 重写WndProc以实现窗口边框拖拽调整大小
        protected override void WndProc(ref Message m)
        {
            switch (m.Msg)
            {
                case WM_NCHITTEST:
                    base.WndProc(ref m);
                    if (this.WindowState != FormWindowState.Maximized)
                    {
                        Point mousePoint = PointToClient(new Point(m.LParam.ToInt32()));
                        if (mousePoint.X < BORDER_WIDTH && mousePoint.Y < BORDER_WIDTH)
                            m.Result = (IntPtr)HTTOPLEFT;
                        else if (mousePoint.X < BORDER_WIDTH && mousePoint.Y > this.Height - BORDER_WIDTH)
                            m.Result = (IntPtr)HTBOTTOMLEFT;
                        else if (mousePoint.X > this.Width - BORDER_WIDTH && mousePoint.Y < BORDER_WIDTH)
                            m.Result = (IntPtr)HTTOPRIGHT;
                        else if (mousePoint.X > this.Width - BORDER_WIDTH && mousePoint.Y > this.Height - BORDER_WIDTH)
                            m.Result = (IntPtr)HTBOTTOMRIGHT;
                        else if (mousePoint.X < BORDER_WIDTH)
                            m.Result = (IntPtr)HTLEFT;
                        else if (mousePoint.X > this.Width - BORDER_WIDTH)
                            m.Result = (IntPtr)HTRIGHT;
                        else if (mousePoint.Y < BORDER_WIDTH)
                            m.Result = (IntPtr)HTTOP;
                        else if (mousePoint.Y > this.Height - BORDER_WIDTH)
                            m.Result = (IntPtr)HTBOTTOM;
                    }
                    break;
                default:
                    base.WndProc(ref m);
                    break;
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    public class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}