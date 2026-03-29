import * as extensionConfig from '../extension.json';

export function activate(status?: 'onStartupFinished', arg?: string): void {}

export function about(): void {
	eda.sys_Dialog.showInformationMessage(
		`EasyEDA AI Bridge v${extensionConfig.version}\nConnecting AI Agents to your EDA workspace.`,
		'About AI Bridge',
	);
}

export async function openIFrame(): Promise<void> {
	await eda.sys_IFrame.openIFrame('/iframe/index.html', 400, 300, 'ai-bridge-test', {
		maximizeButton: true,
		minimizeButton: true,
		title: 'AI Bridge Test',
	});
}
