import * as React from 'react';
import { ACTION, IDockerListDeploymentsRes, DockerDeployment, IDockerDeploymentsChanged, IDockerListDeploymentHistoryRes } from '../../shared/actions';
import { observable, action, ObservableMap } from 'mobx';
import { observer } from 'mobx-react';
import CircularProgress from "@material-ui/core/CircularProgress";
import Box from './Box';
import { withStyles, StyledComponentProps } from "@material-ui/core/styles";
import { hostId } from '../../shared/type';
import Button from '@material-ui/core/Button';
import Time from './Time';
import { IPage } from '../../shared/state';
import state from "./state";
import * as State from '../../shared/state'
import { InformationListRow, InformationList } from './InformationList';
import Typography from '@material-ui/core/Typography';
import Remote from './Remote'
import styles from './styles'

export class DockerContainersState {
    @observable
    hosts: Remote<ObservableMap<number, DockerDeployment[]>> = {state: 'initial'};

    @observable
    containerHistory: ObservableMap<number, ObservableMap<string,  Remote< ObservableMap<number, DockerDeployment> >>> = new ObservableMap;

    @observable
    wtf: number = 0;

    getHosts() {
        switch (this.hosts.state) {
        case 'loading': return null;
        case 'data': return this.hosts.data;
        case 'error': return null;
        case 'initial':
            setTimeout(()=> {
                state.sendMessage({
                    type: ACTION.DockerListDeployments,
                    ref: 0
                });
                this.hosts = {state: 'loading'}
            }, 0);
            return null;
        }
    }

    getHistory(host:number, container: string) {
        let c1 = this.containerHistory.get(host);
        const c2 = (c1 && c1.get(container)) || {state: 'initial'};
        switch (c2.state) {
        case 'loading': return null;
        case 'data': return c2.data;
        case 'error': return null;
        case 'initial':
            setTimeout( () => {
                state.sendMessage({
                    type: ACTION.DockerListDeploymentHistory,
                    host: host,
                    name: container,
                    ref: 0
                });
                if (!c1) {
                    c1 = new ObservableMap();
                    this.containerHistory.set(host, c1);
                }
                c1.set(container, {state: "loading"});
            }, 0);
            return null;
        }
    }


    @action
    handleLoad(act: IDockerListDeploymentsRes) {
        if (this.hosts.state != 'data')
            this.hosts = {state: 'data', data: new ObservableMap()};

        for (const tag of act.deployments) {
            if (!this.hosts.data.has(tag.host))
                this.hosts.data.set(tag.host, []);
            this.hosts.data.get(tag.host).push(tag);
        }
    }

    @action
    handleLoadHistory(act: IDockerListDeploymentHistoryRes) {
        const h = this.containerHistory.get(+act.host);
        if (!h) return;
        const m = new ObservableMap();
        for (const d of act.deployments)
            m.set(d.id, d);
        h.set(act.name, {state: 'data', data:m});
        ++this.wtf;
    }

    @action
    handleChange(act: IDockerDeploymentsChanged) {
        if (this.hosts.state == 'data') {
            const hosts = this.hosts.data;
            for (const tag of act.changed) {
                if (!hosts.has(tag.host))
                    hosts.set(tag.host, []);
                let found = false;
                let lst = hosts.get(tag.host);
                for (let i=0; i < lst.length; ++i) {
                    if (lst[i].name != tag.name) continue;
                    found = true;
                    if (lst[i].id <= tag.id)
                        lst[i] = tag;
                }
                if (!found) lst.push(tag);

            }
            for (const tag of act.removed) {
                if (!hosts.has(tag.host)) continue;
                let lst = hosts.get(tag.host);
                hosts.set(tag.host, lst.filter((e) => e.name != tag.name));
            }
        }

        for (const tag of act.changed) {
            const h = this.containerHistory.get(tag.host);
            if (!h) continue;
            const hh = h.get(tag.name);
            if (!hh || hh.state !== 'data') continue;
            hh.data.set(tag.id, tag);
        }
    }
}

export const HostDockerContainers = withStyles(styles)(observer(function DockerContainers(p:{host:number; title?:string} & StyledComponentProps) {
    const hosts = state.dockerContainers.getHosts();
    if (!hosts) return null;
    if (!state.objectDigests.get(hostId).has(p.host)) return null;
    let hostName = state.objectDigests.get(hostId).get(p.host).name;
    if (!hosts.has(p.host)) return null;
    let containers = hosts.get(p.host).slice();
    containers.sort((a, b)=> {
        return a.name < b.name ? -1 : 1;
    });
    const now = +new Date()/1000;

    let rows = [];
    for (const container of containers) {
        let commit = "";
        if (container.imageInfo && container.imageInfo.labels) {
            commit = (container.imageInfo.labels.GIT_BRANCH || "") + " " + (container.imageInfo.labels.GIT_COMMIT || "");
        }
        const historyPage: IPage = {type: State.PAGE_TYPE.DockerContainerHistory, host: p.host, container: container.name};
        const detailsPage: IPage = {type: State.PAGE_TYPE.DockerContainerDetails, host: p.host, container: container.name, id: container.id};
        rows.push(
            <tr key={container.name}>
                <td>{container.name}</td>
                <td>{container.image}</td>
                <td>{container.state || ""}</td>
                <td>{commit}</td>
                <td>{container.user}</td>
                <td>{container.hash? container.hash.substr(7,12) : ""}</td>
                <td>{container.start?<><Time seconds={now - container.start} /><span> ago</span></>:null}</td>
                <td>{container.end?<><Time seconds={now - container.end} /><span> ago</span></>:null}</td>
                <td>
                    {container.state == "running" ? <Button onClick={()=>state.sendMessage({type: ACTION.DockerContainerStop, host: p.host, container: container.name})}>Stop</Button> : null}
                    {container.state != "running" ? <Button onClick={()=>state.sendMessage({type: ACTION.DockerContainerStart, host: p.host, container: container.name})}>Start</Button> : null}
                    <Button onClick={()=>{confirm("Delete this container from host?") && state.sendMessage({type: ACTION.DockerContainerRemove, host: p.host, container: container.name})}}>Remove</Button>
                    <Button onClick={(e)=>state.page.onClick(e, detailsPage)} href={state.page.link(detailsPage)}>Details</Button>
                    <Button onClick={(e)=>state.page.onClick(e, historyPage)} href={state.page.link(historyPage)}>History</Button>
                </td>
            </tr>
        )
    }
    return <>
        <thead >
            <tr>
                <th colSpan={10} className={p.classes.infoTableHeader}>
                    {p.title || hostName}
                </th>
            </tr>
            <tr>
                <th>Container</th>
                <th>Project</th>
                <th>Status</th>
                <th>Commit</th>
                <th>User</th>
                <th>Hash</th>
                <th>Start</th>
                <th>End</th>
                <td>Actions</td>
            </tr>
        </thead>
        <tbody>
            {rows}
        </tbody>
        </>;

}));

export const DockerContainers = withStyles(styles)(observer(function DockerContainers(p:{host?:string} & StyledComponentProps) {
    const hosts = state.dockerContainers.getHosts();
    if (!hosts) return <CircularProgress />;

    const lst = [];
    const keys = [];
    for (const key of hosts.keys())
        keys.push(key);
    keys.sort();

    for (const host of keys)
        lst.push(<HostDockerContainers key={host} host={host} />)

    return <Box title="Docker containers">
         <table className={p.classes.infoTable}>
            {lst}
         </table>
        </Box>;
}));

export const DockerContainerDetails = withStyles(styles)(observer(function DockerContainerDetails(p:StyledComponentProps) {
    const s = state.dockerContainers;
    const hosts = s.getHosts();
    if (!hosts) return <CircularProgress />;
    const page = state.page.current;
    if (page.type != State.PAGE_TYPE.DockerContainerDetails) return null;
    if (!state.objectDigests.get(hostId).has(page.host)) return null;
    let hostName = state.objectDigests.get(hostId).get(page.host).name;

    let container = null;
    for (const c of hosts.get(page.host)) {
        if (c.id == page.id)
            container = c;
    }
    if (!container) {
        s.wtf;
        const history = s.getHistory(page.host, page.container);
        if (!history)
            return <CircularProgress />;
        container = history.get(page.id);
    }
    if (!container)
        return null;

    let commit = "";
    if (container.imageInfo && container.imageInfo.labels)
        commit = (container.imageInfo.labels.GIT_BRANCH || "") + " " + (container.imageInfo.labels.GIT_COMMIT || "");

    const now = +new Date()/1000;

    return <Box title={`Docker containers details: ${page.container}@${hostName}`}>
        <InformationList>
            <InformationListRow name="Project"><Typography>{container.image}</Typography></InformationListRow>
            <InformationListRow name="Deploy user"><Typography>{container.user}</Typography></InformationListRow>
            <InformationListRow name="Deploy start"><Typography>{container.start?<><Time seconds={now - container.start} /><span> ago</span></>:null}</Typography></InformationListRow>
            <InformationListRow name="Deploy end"><Typography>{container.end?<><Time seconds={now - container.end} /><span> ago</span></>:null}</Typography></InformationListRow>
            <InformationListRow name="Deploy state"><Typography>{container.state}</Typography></InformationListRow>
            <InformationListRow name="Push user"><Typography>{container.imageInfo.user}</Typography></InformationListRow>
            <InformationListRow name="Push time"><Typography>{container.imageInfo.time?<><Time seconds={now - container.imageInfo.time} /><span> ago</span></>:null}</Typography></InformationListRow>
            <InformationListRow name="Push tag"><Typography>{container.imageInfo.tag}</Typography></InformationListRow>
            <InformationListRow name="Build user"><Typography>{container.imageInfo.labels.BUILD_USER}</Typography></InformationListRow>
            <InformationListRow name="Build host"><Typography>{container.imageInfo.labels.BUILD_HOST}</Typography></InformationListRow>
            <InformationListRow name="Image hash"><Typography>{container.imageInfo.hash}</Typography></InformationListRow>
            <InformationListRow name="Image Commit"><Typography>{commit}</Typography></InformationListRow>
        </InformationList>
    </Box>;
}));

export const DockerContainerHistory = withStyles(styles)(observer(function DockerContainerHistory(p: StyledComponentProps) {
    const s = state.dockerContainers;
    const page = state.page.current;
    if (page.type != State.PAGE_TYPE.DockerContainerHistory) return null;
    if (!state.objectDigests.get(hostId).has(page.host)) return null;
    let hostName = state.objectDigests.get(hostId).get(page.host).name;
    s.wtf;
    const history = s.getHistory(page.host, page.container);
    if (!history)
        return <CircularProgress />;

    let containers = [];
    for (const [id, c] of history)
        containers.push(c);

    containers.sort((a, b)=> {
        return a.id < b.id ? 1 : -1;
    });

    const now = +new Date()/1000;

    let rows = [];
    for (const container of containers) {
        let commit = "";
        if (container.imageInfo && container.imageInfo.labels) {
            commit = (container.imageInfo.labels.GIT_BRANCH || "") + " " + (container.imageInfo.labels.GIT_COMMIT || "");
        }
        const detailsPage: IPage = {type: State.PAGE_TYPE.DockerContainerDetails, host: page.host, container: container.name, id: container.id};
        rows.push(
            <tr key={container.id}>
                <td>{commit}</td>
                <td>{container.user}</td>
                <td>{container.hash}</td>
                <td>{container.start?<><Time seconds={now - container.start} /><span> ago</span></>:null}</td>
                <td>{container.end?<><Time seconds={now - container.end} /><span> ago</span></>:null}</td>
                <td>
                    <Button onClick={(e)=>state.page.onClick(e, detailsPage)} href={state.page.link(detailsPage)}>Details</Button>
                </td>
            </tr>
        )
    }
    return <Box title={`Docker containers history: ${page.container}@${hostName}`}>
        <table className={p.classes.infoTable}>
            <thead >
                <tr>
                    <th>Commit</th>
                    <th>User</th>
                    <th>Hash</th>
                    <th>Start</th>
                    <th>End</th>
                    <td>Actions</td>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
         </table>
        </Box>;

    return <div>hat</div>;
}));

