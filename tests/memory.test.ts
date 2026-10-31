import { DuckDbLocation, DuckDbRepository } from '../src/index';
import { runCompatibilitySuite } from './suite';

runCompatibilitySuite(() => DuckDbRepository.getInstance({
    name: 'memory-test',
    location: DuckDbLocation.Memory,
}));
