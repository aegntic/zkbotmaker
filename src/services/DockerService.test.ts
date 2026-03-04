import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

// Mock dockerode before importing DockerService
const mockExec = vi.fn();
const mockExecStart = vi.fn();
const mockExecInspect = vi.fn();
const mockGetContainer = vi.fn();
const mockDemuxStream = vi.fn();

vi.mock('dockerode', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      getContainer: mockGetContainer,
      modem: {
        demuxStream: mockDemuxStream,
      },
    })),
  };
});

import { DockerService } from './DockerService.js';
import { ContainerError } from './docker-errors.js';

describe('DockerService.execCommand', () => {
  let docker: DockerService;

  beforeEach(() => {
    vi.clearAllMocks();
    docker = new DockerService();

    // Default mock chain: getContainer -> exec -> start
    mockGetContainer.mockReturnValue({
      exec: mockExec,
    });
    mockExec.mockResolvedValue({
      start: mockExecStart,
      inspect: mockExecInspect,
    });
  });

  it('should execute command and return stdout', async () => {
    const stream = new EventEmitter();

    mockExecStart.mockResolvedValue(stream);
    mockExecInspect.mockResolvedValue({ ExitCode: 0 });

    // When demuxStream is called, write to stdout and end the stream
    mockDemuxStream.mockImplementation((_stream: EventEmitter, stdout: PassThrough) => {
      stdout.write(Buffer.from('hello world\n'));
      process.nextTick(() => { stream.emit('end'); });
    });

    const result = await docker.execCommand('bob', ['echo', 'hello']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello world\n');
    expect(result.stderr).toBe('');

    expect(mockGetContainer).toHaveBeenCalledWith('botmaker-bob');
    expect(mockExec).toHaveBeenCalledWith({
      Cmd: ['echo', 'hello'],
      AttachStdout: true,
      AttachStderr: true,
    });
  });

  it('should capture stderr separately', async () => {
    const stream = new EventEmitter();

    mockExecStart.mockResolvedValue(stream);
    mockExecInspect.mockResolvedValue({ ExitCode: 1 });

    mockDemuxStream.mockImplementation((_stream: EventEmitter, _stdout: PassThrough, stderr: PassThrough) => {
      stderr.write(Buffer.from('error occurred\n'));
      process.nextTick(() => { stream.emit('end'); });
    });

    const result = await docker.execCommand('bob', ['bad-command']);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('error occurred\n');
  });

  it('should timeout and reject', async () => {
    const stream = new EventEmitter() as EventEmitter & { destroy: () => void };
    stream.destroy = vi.fn();

    mockExecStart.mockResolvedValue(stream);

    mockDemuxStream.mockImplementation(() => {
      // Never emit 'end' — simulates a hanging command
    });

    await expect(docker.execCommand('bob', ['sleep', '999'], 50)).rejects.toThrow(
      'Exec timed out after 50ms',
    );

    expect(stream.destroy).toHaveBeenCalled();
  });

  it('should throw plain Error for exec timeout, not ContainerError', async () => {
    const stream = new EventEmitter() as EventEmitter & { destroy: () => void };
    stream.destroy = vi.fn();

    mockExecStart.mockResolvedValue(stream);

    mockDemuxStream.mockImplementation(() => {
      // Never emit 'end' — simulates a hanging command
    });

    try {
      await docker.execCommand('bob', ['sleep', '999'], 50);
      expect.fail('should have thrown');
    } catch (err) {
      // Must be a plain Error, NOT a ContainerError with NETWORK_ERROR code
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(ContainerError);
      expect((err as Error).message).toContain('Exec timed out');
    }
  });

  it('should handle stream errors', async () => {
    const stream = new EventEmitter();

    mockExecStart.mockResolvedValue(stream);

    mockDemuxStream.mockImplementation(() => {
      process.nextTick(() => { stream.emit('error', new Error('stream broke')); });
    });

    await expect(docker.execCommand('bob', ['cmd'])).rejects.toThrow('stream broke');
  });

  it('should return -1 exit code when ExitCode is null', async () => {
    const stream = new EventEmitter();

    mockExecStart.mockResolvedValue(stream);
    mockExecInspect.mockResolvedValue({ ExitCode: null });

    mockDemuxStream.mockImplementation((_stream: EventEmitter, stdout: PassThrough) => {
      stdout.write(Buffer.from('output'));
      process.nextTick(() => { stream.emit('end'); });
    });

    const result = await docker.execCommand('bob', ['cmd']);
    expect(result.exitCode).toBe(-1);
  });
});
